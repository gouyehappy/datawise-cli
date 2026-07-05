import type {TreeNode} from '@/core/types'
import {t} from '@/i18n'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useShortcutPanelStore} from '@/features/layout/stores/shortcut-panel-store'
import {buildDatabaseConsoleContext} from '@/features/explorer/services/sql-editor-actions.service'
import {resolveConsoleTabTitle} from '@/features/workspace/services/console-tab-title'
import {executeSqlBatch} from '@/features/workspace/services/sql-batch-execute.service'
import {resolveRunSqlBatch} from '@/features/workspace/services/run-sql-batch.service'
import {resolveClientMaxResultRows} from '@/features/settings/services/query-limit.service'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'

export const RUN_SQL_FILE_ACCEPT = '.sql,text/plain,application/sql'

/** 打开文件选择器，用户取消时 resolve null */
export function pickSqlFile(): Promise<File | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = RUN_SQL_FILE_ACCEPT
        input.style.display = 'none'
        document.body.appendChild(input)

        let settled = false
        const finish = (file: File | null) => {
            if (settled) return
            settled = true
            input.remove()
            window.removeEventListener('focus', onWindowFocus)
            resolve(file)
        }

        input.onchange = () => {
            finish(input.files?.[0] ?? null)
        }

        const onWindowFocus = () => {
            window.setTimeout(() => {
                if (!input.files?.length) {
                    finish(null)
                }
            }, 400)
        }
        window.addEventListener('focus', onWindowFocus)
        input.click()
    })
}

/** 数据库节点右键「运行 SQL 文件」：选文件 → 打开控制台 → 批量执行 */
export async function runSqlFileForDatabase(
    tree: TreeNode[],
    databaseNode: Pick<TreeNode, 'id' | 'label'>,
    connectionName?: string,
): Promise<void> {
    const layout = useLayoutStore()
    const workspace = useWorkspaceStore()
    const shortcutPanel = useShortcutPanelStore()
    const appConfig = useAppConfigStore()

    const file = await pickSqlFile()
    if (!file) return

    let sql: string
    try {
        sql = await file.text()
    } catch {
        layout.showErrorToast(t('explorer.runSqlFileReadFailed'))
        return
    }

    const batch = resolveRunSqlBatch(sql)
    if (!batch.length) {
        layout.showErrorToast(t('explorer.runSqlFileEmpty'))
        return
    }

    const ctx = await buildDatabaseConsoleContext(tree, databaseNode, connectionName)
    if (!ctx) {
        layout.showErrorToast(t('explorer.runSqlFileContextMissing'))
        return
    }

    const tabTitle = resolveConsoleTabTitle({
        connectionHost: ctx.connectionHost,
        connectionName: ctx.connectionName,
        sqlFile: file.name,
    })

    const tabId = await workspace.openConsole({
        connectionId: ctx.connectionId,
        connectionName: ctx.connectionName,
        instanceId: ctx.databaseNode.id,
        database: ctx.databaseNode.label,
        sql,
        title: tabTitle,
    })

    layout.showToast(t('explorer.runSqlFileStarted', {name: file.name}))

    const connection = {
        connectionId: ctx.connectionId,
        database: ctx.databaseNode.label,
        maxRows: resolveClientMaxResultRows(),
    }

    const result = await executeSqlBatch(
        batch,
        connection,
        (entry) => shortcutPanel.appendSqlLog(entry, ctx.connectionId),
        {
            onProgress: (results) => {
                appConfig.setShowConsoleResultPanel(true)
                workspace.setConsoleQueryResults(tabId, results)
                const summary = results[0]
                if (summary?.batchEntries) {
                    workspace.setExecutionResult(summary.total, summary.durationMs)
                }
            },
            isPluginEnabled: (pluginId) => usePluginStore().isEnabled(pluginId),
        },
    )

    workspace.setConsoleQueryResults(tabId, result.items)
    workspace.setExecutionResult(result.totalRows, result.totalDuration)

    if (result.lastErrorMessage) {
        workspace.setStatus(result.lastErrorMessage)
        layout.showErrorToast(result.lastErrorMessage)
        return
    }

    const message = t('explorer.runSqlFileDone', {name: file.name, count: batch.length})
    workspace.setStatus(message)
    layout.showToast(message)
}
