import {logPerf} from '@/core/utils/perf-log'
import {computed, nextTick, ref} from 'vue'
import type {SqlEditorExpose} from '@datawise/sql-editor/types'
import {
    parseSqlErrorLine,
    readApiErrorLine,
    resolveEditorErrorLine,
} from '@datawise/sql-editor/utils/sql-error'
import type {DbType} from '@/core/types'
import {ApiError, sqlApi} from '@/api'
import {t} from '@/i18n'
import {isCatalogSchemaDbType} from '@/features/explorer/services/explorer-lazy-load'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useShortcutPanelStore} from '@/features/layout/stores/shortcut-panel-store'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {useTeamStore} from '@/features/team/stores/team-store'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {
    canDmlConnection,
    requiresDdlAccess,
    requiresWriteAccess,
    resolveConnectionAccess,
} from '@/features/team/services/connection-access.service'
import {splitSqlStatements} from '@/features/workspace/services/split-sql-statements'
import {resolveClientMaxResultRows, resolveSqlPageSize} from '@/features/settings/services/query-limit.service'
import {resolveExecutableSql as pickExecutableSql} from '@/features/workspace/services/resolve-executable-sql'
import {
    buildErrorQueryResultItem,
    buildSuccessQueryResultItem,
} from '@/features/workspace/services/query-result-item'
import {
    replaceConsoleQueryResultAtIndex,
    sumConsoleQueryTotals,
} from '@/features/workspace/services/query-result-refresh.service'
import type {QueryResultItem} from '@/features/workspace/types'
import {executeSqlBatch} from '@/features/workspace/services/sql-batch-execute.service'
import {registerConnectionHealthCheck} from '@/features/explorer/services/register-connection-health.service'
import {useConnectionCapabilities} from '@/shared/capabilities/useConnectionCapabilities'
import {
    runPluginAfterResult,
    runPluginBeforeExecute,
} from '@/features/plugin/services/plugin-hook.service'

export type SqlRunPerfSource = 'toolbar' | 'gutter' | 'shortcut' | 'context-menu' | 'explain' | 'editor'

export type SqlRunOptions = {
    /** 结果区刷新：仅更新指定结果 Tab，不替换其它 Tab */
    refreshResultIndex?: number
    /** 跳过危险 SQL 工具栏确认（提交待执行语句时） */
    skipDangerousCheck?: boolean
    /** PERF 日志来源（行内运行、工具栏、快捷键等） */
    perfSource?: SqlRunPerfSource
}

export interface SqlEditorActionsOptions {
    getTabId: () => string
    getSql: () => string
    getSqlFile: () => string | undefined
    getConnectionId: () => string | undefined
    getInstanceId: () => string | null | undefined
    getDatabase: () => string | undefined
    getConnectionLabel: () => string
    getInstanceLabel: () => string | null | undefined
    getDbType: () => DbType | undefined
    editorRef: () => SqlEditorExpose | null
    onExecuteComplete?: () => void
    /** 执行前确认（危险 SQL 预览等） */
    beforeExecute?: (sql: string) => Promise<boolean>
    /** 将参数占位符替换为实际值 */
    applyParameters?: (sql: string) => string
    /** 当前连接是否启用生产环境性能模式收紧策略 */
    getProductionPerfActive?: () => boolean
}

async function jumpEditorToErrorLine(editor: SqlEditorExpose | null, line: number) {
    if (!editor || line < 1) return
    await nextTick()
    requestAnimationFrame(() => {
        editor.goToLine(line)
        editor.layout()
    })
}

function resolveStatementErrorLine(options: {
    editor: SqlEditorExpose | null
    editorText: string
    statement: string
    message: string
    apiError: unknown
    anchorLine?: number | null
}): number | null {
    const apiLine = options.apiError instanceof ApiError ? readApiErrorLine(options.apiError.data) : null
    const parsedLine = parseSqlErrorLine(options.message, options.statement.trim())
    const errorLineInSql = apiLine ?? parsedLine
    const selectionStart =
        options.anchorLine
        ?? options.editor?.getSelectionStartLine()
        ?? options.editor?.getCurrentLineNumber()
        ?? null
    return resolveEditorErrorLine({
        editorText: options.editorText,
        executable: options.statement,
        errorLineInSql,
        selectionStartLine: selectionStart,
    })
}

function logSqlEditorExecutePerf(
    startedAt: number,
    runOptions: SqlRunOptions | undefined,
    details: Record<string, unknown>,
) {
    logPerf('sql.editor.execute', startedAt, {
        source: runOptions?.perfSource ?? 'editor',
        ...details,
    })
}

/** 控制台 SQL 编辑器的执行、保存、格式化 */
export function useSqlEditorActions(options: SqlEditorActionsOptions) {
    const shortcutPanel = useShortcutPanelStore()
    const workspace = useWorkspaceStore()
    const auth = useAuthStore()
    const appConfig = useAppConfigStore()
    const teamStore = useTeamStore()
    const running = ref(false)
    const dbType = computed(() => options.getDbType())
    const {caps: connectionCaps} = useConnectionCapabilities(dbType)

    function isPluginHookEnabled(pluginId: string) {
        return usePluginStore().isEnabled(pluginId)
    }

    async function applyPluginBeforeExecute(sql: string, connectionId: string, database?: string) {
        const result = await runPluginBeforeExecute(
            {sql, connectionId, database},
            isPluginHookEnabled,
        )
        if (result.cancel) {
            notifyActionIssue(result.message ?? t('console.runFailed'))
            return null
        }
        return result.sql ?? sql
    }

    async function emitPluginAfterResult(payload: {
        sql: string
        connectionId: string
        database?: string
        success: boolean
        rowCount?: number
        durationMs?: number
        errorMessage?: string
    }) {
        await runPluginAfterResult(payload, isPluginHookEnabled)
    }

    function notifySuccess(message: string) {
        workspace.setStatus(message)
    }

    function notifyActionIssue(message: string) {
        workspace.setStatus(message)
    }

    function resolveExecutableSql(executableOverride?: unknown) {
        const editor = options.editorRef()
        return pickExecutableSql(
            executableOverride,
            () => editor?.getSelectedText() ?? '',
            {
                fallbackToCurrentLineSql: () => editor?.getCurrentLineSql() ?? '',
                getCurrentLineNumber: () => editor?.getCurrentLineNumber() ?? null,
                fallbackToFullDocument: () => options.getSql(),
                getSelectionStartLine: () => editor?.getSelectionStartLine() ?? null,
            },
        )
    }

    function runSql(executableOverride?: unknown, runOptions?: SqlRunOptions) {
        const editor = options.editorRef()
        const {sql: executable, anchorLine} = resolveExecutableSql(executableOverride)
        if (!executable.trim()) {
            notifyActionIssue(t('console.selectionRequired'))
            return
        }

        const connectionId = options.getConnectionId()
        if (!connectionId) {
            notifyActionIssue(t('console.connectionRequired'))
            return
        }

        const dbType = options.getDbType()
        if (!connectionCaps.value.sqlExecute) {
            notifyActionIssue(t('console.sqlNotSupported', {dbType: dbType ?? 'unknown'}))
            return
        }

        const access = resolveConnectionAccess(connectionId, teamStore.teams)
        if (requiresDdlAccess(executable) && access !== 'ddl') {
            notifyActionIssue(t('console.ddlNotAllowed'))
            return
        }
        if (requiresWriteAccess(executable) && access === 'readonly') {
            notifyActionIssue(t('console.readOnlyConnection'))
            return
        }

        const refreshIndex = runOptions?.refreshResultIndex
        const isRefresh = refreshIndex !== undefined

        running.value = true
        appConfig.setShowConsoleResultPanel(true)
        void (async () => {
            const started = performance.now()
        const editorText = options.getSql()
        const trimmedExecutable = executable.trim()
        const resolvedSql = options.applyParameters?.(trimmedExecutable) ?? trimmedExecutable
        const tabId = options.getTabId()
            // 新查询开始时清空上次结果，保证执行中只显示消息区
            if (!isRefresh) {
                workspace.setConsoleQueryResults(tabId, [])
            }
            const pageSize = resolveSqlPageSize(options.getProductionPerfActive?.() ?? false)
            const maxRows = resolveClientMaxResultRows(options.getProductionPerfActive?.() ?? false)
            const connection = {
                connectionId,
                database: options.getDatabase(),
                pageSize,
                maxRows: maxRows > 0 ? maxRows : undefined,
                dbType: options.getDbType(),
                sessionKey: tabId,
                perfSource: runOptions?.perfSource,
            }

            function applyRefreshResult(index: number, item: QueryResultItem) {
                const next = replaceConsoleQueryResultAtIndex(
                    workspace.consoleQueryByTabId,
                    tabId,
                    index,
                    item,
                )
                workspace.consoleQueryByTabId = next
                const state = next[tabId]
                if (state) {
                    const {totalRows, totalDuration} = sumConsoleQueryTotals(state.results)
                    workspace.setExecutionResult(totalRows, totalDuration)
                }
            }

            function applySuccessResult(result: Awaited<ReturnType<typeof sqlApi.execute>>, sql: string, index: number) {
                const item = buildSuccessQueryResultItem(result, index, sql, connection.dbType)
                if (isRefresh) {
                    applyRefreshResult(refreshIndex!, item)
                } else {
                    workspace.setConsoleQueryResults(tabId, [item])
                    workspace.setExecutionResult(result.rowCount, result.durationMs)
                }
            }

            function applyErrorResult(payload: {
                sql: string
                errorMessage: string
                errorLine?: number
                durationMs?: number
            }, index: number) {
                const item = buildErrorQueryResultItem(payload, index)
                if (isRefresh) {
                    applyRefreshResult(refreshIndex!, item)
                } else {
                    workspace.setConsoleQueryResults(tabId, [item])
                }
            }

            try {
                editor?.clearErrorLine()
                const statements = splitSqlStatements(resolvedSql)
                const batch = statements.length > 1 ? statements : [statements[0] ?? resolvedSql]

                if (options.beforeExecute) {
                    for (const statement of batch) {
                        const allowed = await options.beforeExecute(statement)
                        if (!allowed) {
                            running.value = false
                            return
                        }
                    }
                }

                if (batch.length === 1) {
                    let sql = batch[0]
                    const resultIndex = isRefresh ? refreshIndex! : 0
                    try {
                        const hookedSql = await applyPluginBeforeExecute(sql, connectionId, connection.database)
                        if (hookedSql == null) return
                        sql = hookedSql
                        const result = await sqlApi.execute(sql, connection)
                        registerConnectionHealthCheck(connectionId, 'ok')
                        applySuccessResult(result, sql, resultIndex)
                        logSqlEditorExecutePerf(started, runOptions, {
                            connectionId,
                            database: connection.database,
                            rowCount: result.rowCount,
                            serverDurationMs: result.durationMs,
                            sqlLen: sql.length,
                        })
                        await emitPluginAfterResult({
                            sql,
                            connectionId,
                            database: connection.database,
                            success: true,
                            rowCount: result.rowCount,
                            durationMs: result.durationMs,
                        })
                        void shortcutPanel.appendSqlLog(
                            {
                                sql: result.sql,
                                time: new Date().toLocaleTimeString(),
                                duration: `${result.durationMs}ms`,
                                durationMs: result.durationMs,
                                status: 'success',
                                rows: result.rowCount,
                                database: connection.database,
                            },
                            connectionId,
                            connection.database,
                        ).catch((logError) => {
                            console.warn('[appendSqlLog]', logError)
                        })
                    } catch (error) {
                        const message = error instanceof Error ? error.message : t('console.runFailed')
                        const durationMs = Math.round(performance.now() - started)
                        logSqlEditorExecutePerf(started, runOptions, {
                            connectionId,
                            database: connection.database,
                            ok: false,
                            sqlLen: sql.length,
                        })
                        const errorLine = resolveStatementErrorLine({
                            editor,
                            editorText,
                            statement: sql,
                            message,
                            apiError: error,
                            anchorLine,
                        })

                        applyErrorResult(
                            {
                                sql,
                                errorMessage: message,
                                errorLine: errorLine ?? undefined,
                                durationMs,
                            },
                            resultIndex,
                        )
                        await emitPluginAfterResult({
                            sql,
                            connectionId,
                            database: connection.database,
                            success: false,
                            durationMs,
                            errorMessage: message,
                        })
                        notifyActionIssue(message)

                        if (errorLine) {
                            await jumpEditorToErrorLine(editor, errorLine)
                        }

                        void shortcutPanel.appendSqlLog(
                            {
                                sql,
                                time: new Date().toLocaleTimeString(),
                                duration: `${durationMs}ms`,
                                durationMs,
                                status: 'error',
                                database: connection.database,
                            },
                            connectionId,
                            connection.database,
                        ).catch((logError) => {
                            console.warn('[appendSqlLog]', logError)
                        })
                    }
                    return
                }

                const result = await executeSqlBatch(
                    batch,
                    connection,
                    (entry) => shortcutPanel.appendSqlLog(
                        {...entry, database: connection.database},
                        connectionId,
                        connection.database,
                    ),
                    {
                        onProgress: (results) => {
                            appConfig.setShowConsoleResultPanel(true)
                            workspace.setConsoleQueryResults(tabId, results)
                            const summary = results[0]
                            if (summary?.batchEntries) {
                                workspace.setExecutionResult(summary.total, summary.durationMs)
                            }
                        },
                        resolveErrorLine: (sql, message, error) =>
                            resolveStatementErrorLine({
                                editor,
                                editorText,
                                statement: sql,
                                message,
                                apiError: error,
                                anchorLine,
                            }) ?? undefined,
                        isPluginEnabled: isPluginHookEnabled,
                    },
                )

                workspace.setConsoleQueryResults(tabId, result.items)
                workspace.setExecutionResult(result.totalRows, result.totalDuration)
                registerConnectionHealthCheck(connectionId, 'ok')
                logPerf('sql.editor.execute.batch', started, {
                    source: runOptions?.perfSource ?? 'editor',
                    connectionId,
                    database: connection.database,
                    statementCount: batch.length,
                    totalRows: result.totalRows,
                    serverDurationMs: result.totalDuration,
                })

                if (result.lastErrorMessage) {
                    notifyActionIssue(result.lastErrorMessage)
                    if (result.firstErrorLine) {
                        await jumpEditorToErrorLine(editor, result.firstErrorLine)
                    }
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : t('console.runFailed')
                notifyActionIssue(message)
                console.error('[runSql]', error)
            } finally {
                running.value = false
                options.onExecuteComplete?.()
            }
        })()
    }

    function onExecuteClick() {
        runSql(undefined, {perfSource: 'toolbar'})
    }

    function saveConsole() {
        if (auth.isGuest) {
            notifyActionIssue(t('auth.guestReadOnlyHint'))
            return
        }
        const connectionId = options.getConnectionId()
        if (!connectionId) {
            notifyActionIssue(t('console.connectionRequired'))
            return
        }

        const instanceName = options.getInstanceLabel()?.trim()
        const dbType = options.getDbType()
        if (!instanceName && !isCatalogSchemaDbType(dbType)) {
            notifyActionIssue(t('console.instanceRequired'))
            return
        }

        void workspace.saveConsoleTab(options.getTabId()).then((ok) => {
            if (!ok) {
                notifyActionIssue(t('console.saveFailed'))
            }
        })
    }

    function formatSql() {
        options.editorRef()?.formatDocument()
        workspace.setStatus(t('console.formatted'))
    }

    function formatSelection() {
        const ok = options.editorRef()?.formatSelection() ?? false
        if (ok) workspace.setStatus(t('console.formatted'))
    }

    function jumpToErrorLine(lineNumber: number) {
        void jumpEditorToErrorLine(options.editorRef(), lineNumber)
    }

    return {running, runSql, onExecuteClick, saveConsole, formatSql, formatSelection, jumpToErrorLine}
}
