import type {ComposerTranslation} from 'vue-i18n'
import type {TreeNode, WorkspaceTab} from '@/core/types'
import {findDatabaseLabel} from '@/core/utils/tree'
import {datagenApi, tableDetailApi} from '@/api'
import {downloadTextFile} from '@/features/ai/analysis/services/analysis-export.service'
import {
    clampFakeDataRowCount,
} from '@/features/workspace/services/fake-data.service'
import {canDmlConnection} from '@/features/team/services/connection-access.service'
import type {TeamSummary} from '@/core/types'

export function resolveDatabaseName(tab: WorkspaceTab, tree: TreeNode[]): string | undefined {
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

export async function previewFakeDataForTab(options: {
    tab: WorkspaceTab
    tree: TreeNode[]
    rowCount: number
    seed?: number
}) {
    const {tab, tree, rowCount, seed} = options
    if (tab.type !== 'table' || !tab.tableName?.trim() || !tab.connectionId) {
        throw new Error('invalid table tab')
    }
    return datagenApi.previewTableDatagen({
        connectionId: tab.connectionId,
        database: resolveDatabaseName(tab, tree),
        tableName: tab.tableName,
        rowCount: clampFakeDataRowCount(rowCount),
        seed,
    })
}

export async function executeFakeDataForTab(options: {
    tab: WorkspaceTab
    tree: TreeNode[]
    properties: Awaited<ReturnType<typeof fetchFakeDataProperties>>
    rowCount: number
    seed?: number
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
    if (!tab.tableName?.trim()) {
        showToast(t('workspace.fakeData.failed'))
        return false
    }

    await datagenApi.executeTableDatagen({
        connectionId: tab.connectionId,
        database: resolveDatabaseName(tab, tree),
        tableName: tab.tableName,
        rowCount: clampFakeDataRowCount(rowCount),
        seed: options.seed,
    })
    showToast(t('workspace.fakeData.executed', {count: clampFakeDataRowCount(rowCount)}))
    return true
}

export async function exportFakeDataForTab(options: {
    tab: WorkspaceTab
    tree: TreeNode[]
    properties: Awaited<ReturnType<typeof fetchFakeDataProperties>>
    rowCount: number
    seed?: number
    showToast: (message: string) => void
    t: ComposerTranslation
}) {
    const {tab, tree, properties, rowCount, showToast, t} = options
    const preview = await previewFakeDataForTab({tab, tree, rowCount, seed: options.seed})
    const sql = preview.insertSql
    const tableName = properties.tableName || tab.tableName || 'table'
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadTextFile(sql, `${tableName}-fake-data-${stamp}.sql`, 'text/plain;charset=utf-8')
    showToast(t('workspace.fakeData.exported'))
}
