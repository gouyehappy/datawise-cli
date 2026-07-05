import type {ComposerTranslation} from 'vue-i18n'
import type {TreeNode, WorkspaceTab} from '@/core/types'
import {findDatabaseLabel} from '@/core/utils/tree'
import {tableDetailApi, sqlApi} from '@/api'
import {downloadTextFile} from '@/features/ai/analysis/services/analysis-export.service'
import {
    buildFakeDataInsertSql,
    buildFakeDataRows,
    clampFakeDataRowCount,
} from '@/features/workspace/services/fake-data.service'
import {canDmlConnection} from '@/features/team/services/connection-access.service'
import type {TeamSummary} from '@/core/types'

function resolveDatabaseName(tab: WorkspaceTab, tree: TreeNode[]): string | undefined {
    if (tab.database?.trim()) return tab.database.trim()
    if (tab.instanceId) {
        return findDatabaseLabel(tree, tab.instanceId) ?? undefined
    }
    return undefined
}

export async function fetchFakeDataProperties(tab: WorkspaceTab, tree: TreeNode[]) {
    if (tab.type !== 'table' || !tab.tableName?.trim() || !tab.connectionId) {
        throw new Error('invalid table tab')
    }
    return tableDetailApi.fetchProperties(tab.tableName, {
        connectionId: tab.connectionId,
        database: resolveDatabaseName(tab, tree),
    })
}

export function buildFakeDataSqlForTab(
    tab: WorkspaceTab,
    tree: TreeNode[],
    properties: Awaited<ReturnType<typeof fetchFakeDataProperties>>,
    rowCount: number,
) {
    const rows = buildFakeDataRows(properties, clampFakeDataRowCount(rowCount))
    return buildFakeDataInsertSql({
        properties,
        rows,
        dbType: tab.dbType,
        database: resolveDatabaseName(tab, tree),
    })
}

export async function executeFakeDataForTab(options: {
    tab: WorkspaceTab
    tree: TreeNode[]
    properties: Awaited<ReturnType<typeof fetchFakeDataProperties>>
    rowCount: number
    teams: TeamSummary[]
    isGuest: boolean
    showToast: (message: string) => void
    t: ComposerTranslation
}): Promise<boolean> {
    const {tab, tree, properties, rowCount, teams, isGuest, showToast, t} = options
    if (isGuest) {
        showToast(t('auth.guestReadOnlyHint'))
        return false
    }
    if (!tab.connectionId || !canDmlConnection(tab.connectionId, teams)) {
        showToast(t('workspace.fakeData.writeDenied'))
        return false
    }
    const insertable = properties.columns.filter((column) => !(column.autoIncrement && column.keyType === 'PRI'))
    if (!insertable.length) {
        showToast(t('workspace.fakeData.noColumns'))
        return false
    }

    const sql = buildFakeDataSqlForTab(tab, tree, properties, rowCount)
    const database = resolveDatabaseName(tab, tree)
    await sqlApi.execute(sql, {
        connectionId: tab.connectionId,
        database,
    })
    showToast(t('workspace.fakeData.executed', {count: clampFakeDataRowCount(rowCount)}))
    return true
}

export function exportFakeDataForTab(options: {
    tab: WorkspaceTab
    tree: TreeNode[]
    properties: Awaited<ReturnType<typeof fetchFakeDataProperties>>
    rowCount: number
    showToast: (message: string) => void
    t: ComposerTranslation
}) {
    const {tab, tree, properties, rowCount, showToast, t} = options
    const sql = buildFakeDataSqlForTab(tab, tree, properties, rowCount)
    const tableName = properties.tableName || tab.tableName || 'table'
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadTextFile(sql, `${tableName}-fake-data-${stamp}.sql`, 'text/plain;charset=utf-8')
    showToast(t('workspace.fakeData.exported'))
}
