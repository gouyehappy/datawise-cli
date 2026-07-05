import {sqlApi} from '@/api'
import type {DbType} from '@/core/types'
import type {SqlExecuteOptions} from '@/shared/api/types'
import {
    buildErrorQueryResultItem,
    buildSuccessQueryResultItem,
} from '@/features/workspace/services/query-result-item'
import type {QueryResultItem} from '@/features/workspace/types'
import {
    appendStreamingBatchSummaryItem,
    collapseBatchResultsToSummary,
    createStreamingBatchSummaryItem,
    finishStreamingBatchSummaryItem,
    shouldCollapseBatchResults,
} from '@/features/workspace/services/query-result-batch.service'
import {
    runPluginAfterResult,
    runPluginBeforeExecute,
} from '@/features/plugin/services/plugin-hook.service'

export interface SqlBatchExecuteResult {
    items: QueryResultItem[]
    totalRows: number
    totalDuration: number
    lastErrorMessage: string | null
    firstErrorLine?: number
}

export type SqlLogEntry = {
    sql: string
    time: string
    duration: string
    durationMs?: number
    status: 'success' | 'error'
    rows?: number
}

export interface SqlBatchExecuteOptions {
    /** 批量执行时每完成一条语句回调，用于流式更新结果区 */
    onProgress?: (results: QueryResultItem[]) => void
    resolveErrorLine?: (sql: string, message: string, error: unknown) => number | undefined
    /** 已启用插件判定；传入时对每条语句运行 beforeExecute / afterResult Hook */
    isPluginEnabled?: (pluginId: string) => boolean
}

/** 按顺序执行多条 SQL；任一条失败即停止，不再执行后续语句 */
export async function executeSqlBatch(
    statements: string[],
    connection: SqlExecuteOptions & { connectionId: string; dbType?: DbType },
    appendLog?: (entry: SqlLogEntry) => Promise<void>,
    options?: SqlBatchExecuteOptions,
    execute: typeof sqlApi.execute = sqlApi.execute,
): Promise<SqlBatchExecuteResult> {
    const items: QueryResultItem[] = []
    let totalRows = 0
    let totalDuration = 0
    let lastErrorMessage: string | null = null
    let firstErrorLine: number | undefined

    const useStreaming = statements.length > 1 && Boolean(options?.onProgress)
    const batchId = `batch-${Date.now()}`
    let streamingSummary: QueryResultItem | null = null

    if (useStreaming) {
        streamingSummary = createStreamingBatchSummaryItem(statements.length, batchId)
        options!.onProgress!([streamingSummary])
    }

    for (let i = 0; i < statements.length; i++) {
        let sql = statements[i]
        const stmtStarted = performance.now()

        if (options?.isPluginEnabled) {
            const hooked = await runPluginBeforeExecute(
                {
                    sql,
                    connectionId: connection.connectionId,
                    database: connection.database,
                },
                options.isPluginEnabled,
            )
            if (hooked.cancel) {
                const message = hooked.message ?? 'Run blocked by plugin'
                lastErrorMessage = message
                items.push(
                    buildErrorQueryResultItem(
                        {sql, errorMessage: message, durationMs: 0},
                        i,
                    ),
                )
                await runPluginAfterResult(
                    {
                        sql,
                        connectionId: connection.connectionId,
                        database: connection.database,
                        success: false,
                        errorMessage: message,
                    },
                    options.isPluginEnabled,
                )
                break
            }
            sql = hooked.sql ?? sql
        }

        try {
            const result = await execute(sql, connection)
            totalRows += result.rowCount
            totalDuration += result.durationMs
            items.push(buildSuccessQueryResultItem(result, i, sql, connection.dbType))
            if (options?.isPluginEnabled) {
                await runPluginAfterResult(
                    {
                        sql: result.sql,
                        connectionId: connection.connectionId,
                        database: connection.database,
                        success: true,
                        rowCount: result.rowCount,
                        durationMs: result.durationMs,
                    },
                    options.isPluginEnabled,
                )
            }
            void appendLog?.({
                sql: result.sql,
                time: new Date().toLocaleTimeString(),
                duration: `${result.durationMs}ms`,
                durationMs: result.durationMs,
                status: 'success',
                rows: result.rowCount,
            }).catch(() => {})
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Run failed'
            const durationMs = Math.round(performance.now() - stmtStarted)
            const errorLine = options?.resolveErrorLine?.(sql, message, error)
            if (errorLine && firstErrorLine === undefined) {
                firstErrorLine = errorLine
            }
            lastErrorMessage = message
            items.push(
                buildErrorQueryResultItem(
                    {sql, errorMessage: message, durationMs, errorLine},
                    i,
                ),
            )
            if (options?.isPluginEnabled) {
                await runPluginAfterResult(
                    {
                        sql,
                        connectionId: connection.connectionId,
                        database: connection.database,
                        success: false,
                        durationMs,
                        errorMessage: message,
                    },
                    options.isPluginEnabled,
                )
            }
            void appendLog?.({
                sql,
                time: new Date().toLocaleTimeString(),
                duration: `${durationMs}ms`,
                durationMs,
                status: 'error',
            }).catch(() => {})
            break
        }

        if (streamingSummary && options?.onProgress) {
            streamingSummary = appendStreamingBatchSummaryItem(
                streamingSummary,
                items[items.length - 1],
                i,
            )
            options.onProgress([streamingSummary])
        }
    }

    const collapsed = collapseBatchResultsToSummary(items)
    let finalItems = collapsed

    if (useStreaming && shouldCollapseBatchResults(items) && collapsed.length === 1) {
        finalItems = [
            finishStreamingBatchSummaryItem({
                ...collapsed[0],
                id: batchId,
            }),
        ]
        options!.onProgress!(finalItems)
    } else if (useStreaming && !shouldCollapseBatchResults(items)) {
        options!.onProgress!(collapsed)
    }

    return {
        items: finalItems,
        totalRows,
        totalDuration,
        lastErrorMessage,
        firstErrorLine,
    }
}
