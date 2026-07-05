import type {WorkspaceTab} from '@/core/types'
import type {WorkspaceTabSnapshot} from '@/shared/config/app-config.types'

const RESTORABLE_TAB_TYPES = new Set<WorkspaceTab['type']>(['console', 'table', 'terminal'])

export function captureWorkspaceTabs(tabs: WorkspaceTab[]): WorkspaceTabSnapshot[] {
    return tabs
        .filter((tab) => RESTORABLE_TAB_TYPES.has(tab.type))
        .map((tab) => ({
            type: tab.type,
            title: tab.title,
            sql: tab.sql,
            savedSql: tab.savedSql,
            sqlFile: tab.sqlFile,
            tableName: tab.tableName,
            connectionId: tab.connectionId,
            instanceId: tab.instanceId,
            database: tab.database,
            explorerNodeId: tab.explorerNodeId,
            dbType: tab.dbType,
            tableView: tab.tableView,
            tableSection: tab.tableSection,
        }))
}

export function resolveActiveTabIndex(tabs: WorkspaceTab[], activeTabId: string | null): number {
    if (!activeTabId || !tabs.length) return 0
    const index = tabs.findIndex((tab) => tab.id === activeTabId)
    return index >= 0 ? index : 0
}
