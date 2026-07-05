import {computed, ref, watch} from 'vue'
import type {TableColumn, TableRow, TreeNode, WorkspaceTab} from '@/core/types'
import {findDatabaseLabel} from '@/core/utils/tree'
import {logPerf, perfNow} from '@/core/utils/perf-log'
import type {TableColumnDetail, TableDataResult, TablePropertiesResult} from '@/shared/api/types'
import type {GridPendingBatch} from '@/core/composables/useGridPendingEdit'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useTeamStore} from '@/features/team/stores/team-store'
import {canDmlConnection} from '@/features/team/services/connection-access.service'
import {tableDataApi, tableDetailApi} from '@/api'
import {resolveTableViewOptions} from '../services/table-data.service'
import {resolveSqlPageSize} from '@/features/settings/services/query-limit.service'
import {
    buildRowMutateValues,
    resolvePrimaryKeyColumns,
} from '@/features/workspace/services/table-row-mutate.service'
import {useConnectionCapabilities} from '@/shared/capabilities/useConnectionCapabilities'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {useI18n} from 'vue-i18n'

const EMPTY: TableDataResult = {columns: [], rows: []}
const EMPTY_PROPERTIES: TablePropertiesResult = {
    tableName: '',
    columns: [],
    foreignKeys: [],
    indexes: [],
}

function resolveDatabaseName(tab: WorkspaceTab, tree: TreeNode[]): string | undefined {
    if (tab.database?.trim()) return tab.database.trim()
    if (tab.instanceId) {
        return findDatabaseLabel(tree, tab.instanceId) ?? undefined
    }
    return undefined
}

/** 表数据 Tab：加载、刷新、批量提交新增/编辑/删除 */
export function useTableDataView(tab: WorkspaceTab) {
    const explorer = useExplorerStore()
    const teamStore = useTeamStore()
    const pluginStore = usePluginStore()
    const {t} = useI18n()
    const tableData = ref<TableDataResult>(EMPTY)
    const tableProperties = ref<TablePropertiesResult>(EMPTY_PROPERTIES)
    const loading = ref(false)
    const cursorLoading = ref(false)
    const mutating = ref(false)
    const loadError = ref<string | null>(null)

    const databaseName = computed(() => resolveDatabaseName(tab, explorer.tree))
    const connectionDbType = computed(() => {
        if (!tab.connectionId) return undefined
        return explorer.findNode(tab.connectionId)?.dbType
    })
    const {caps: connectionCaps, hint: capabilityHint} = useConnectionCapabilities(connectionDbType)
    const primaryKeyColumns = computed(() => resolvePrimaryKeyColumns(tableProperties.value.columns))
    const canDelete = computed(() => primaryKeyColumns.value.length > 0)
    const canUpdate = computed(() => primaryKeyColumns.value.length > 0)
    const connectionWritable = computed(() => canDmlConnection(tab.connectionId, teamStore.teams))
    const gridEditEnabled = computed(() => pluginStore.isEnabled('p-grid-edit'))
    const gridEditable = computed(
        () => gridEditEnabled.value && connectionWritable.value && connectionCaps.value.tableMutation,
    )
    const effectiveCanDelete = computed(
        () => gridEditEnabled.value && canDelete.value && connectionWritable.value && connectionCaps.value.tableMutation,
    )
    const effectiveCanUpdate = computed(
        () => gridEditEnabled.value && canUpdate.value && connectionWritable.value && connectionCaps.value.tableMutation,
    )
    const editDisabledHint = computed(() => {
        if (gridEditable.value) return undefined
        const fakeDataEnabled = pluginStore.isEnabled('p-fake-data')
        if (
            !gridEditEnabled.value
            && fakeDataEnabled
            && connectionWritable.value
            && connectionCaps.value.tableMutation
        ) {
            return t('dataGrid.gridEditTryFakeData')
        }
        if (!gridEditEnabled.value) return t('dataGrid.gridEditPluginDisabled')
        if (!connectionWritable.value) return t('dataGrid.gridEditTeamReadonly')
        if (!connectionCaps.value.tableMutation) return capabilityHint('tableMutation')
        return undefined
    })

    async function loadProperties() {
        if (!tab.tableName?.trim() || !tab.connectionId) {
            tableProperties.value = EMPTY_PROPERTIES
            return
        }
        const startedAt = perfNow()
        const details = {
            connectionId: tab.connectionId,
            table: tab.tableName,
            database: databaseName.value,
        }
        try {
            tableProperties.value = await tableDetailApi.fetchProperties(tab.tableName, {
                connectionId: tab.connectionId,
                database: databaseName.value,
                kind: tab.relationKind ?? 'table',
            })
            logPerf('table.open.properties', startedAt, {
                ...details,
                columnCount: tableProperties.value.columns.length,
            })
        } catch {
            tableProperties.value = EMPTY_PROPERTIES
            logPerf('table.open.properties', startedAt, {...details, ok: false})
        }
    }

    async function load() {
        loadError.value = null
        if (!tab.tableName?.trim() || !tab.connectionId) {
            tableData.value = EMPTY
            return
        }

        loading.value = true
        const startedAt = perfNow()
        const details = {
            connectionId: tab.connectionId,
            table: tab.tableName,
            database: databaseName.value,
        }
        try {
            tableData.value = await tableDataApi.fetch(tab.tableName, {
                connectionId: tab.connectionId,
                database: databaseName.value,
                maxRows: resolveSqlPageSize(),
            })
            logPerf('table.open.data', startedAt, {
                ...details,
                rowCount: tableData.value.rows.length,
            })
        } catch (error) {
            tableData.value = EMPTY
            loadError.value = error instanceof Error ? error.message : 'Failed to load table data'
            logPerf('table.open.data', startedAt, {...details, ok: false})
        } finally {
            loading.value = false
        }
    }

    async function submitChanges(batch: GridPendingBatch) {
        if (!tab.tableName?.trim() || !tab.connectionId) return false
        if (!connectionWritable.value) return false
        mutating.value = true
        try {
            // 先删后改再增，减少主键/唯一约束冲突
            for (const row of batch.deletes) {
                await tableDataApi.deleteRow(tab.tableName, {
                    connectionId: tab.connectionId,
                    database: databaseName.value,
                    values: buildRowMutateValues(row, tableData.value.columns),
                })
            }
            for (const update of batch.updates) {
                await tableDataApi.updateRow(tab.tableName, {
                    connectionId: tab.connectionId,
                    database: databaseName.value,
                    keyValues: update.keyValues,
                    values: update.values,
                })
            }
            for (const values of batch.inserts) {
                await tableDataApi.insertRow(tab.tableName, {
                    connectionId: tab.connectionId,
                    database: databaseName.value,
                    values,
                })
            }
            await load()
            return true
        } finally {
            mutating.value = false
        }
    }

    watch(
        () =>
            [tab.tableName, tab.connectionId, tab.instanceId, tab.database, databaseName.value, explorer.treeReady] as const,
        () => {
            void loadProperties()
            void load()
        },
        {immediate: true, deep: true},
    )

    async function loadMore() {
        const cursorId = tableData.value.cursorId
        if (!tab.tableName?.trim() || !tab.connectionId || !cursorId || cursorLoading.value) return
        cursorLoading.value = true
        try {
            const page = await tableDataApi.fetch(tab.tableName, {
                connectionId: tab.connectionId,
                database: databaseName.value,
                cursorId,
            })
            tableData.value = {
                ...tableData.value,
                rows: [...tableData.value.rows, ...page.rows],
                cursorId: page.cursorId,
                hasMore: page.hasMore,
                pageOffset: page.pageOffset,
                pageSize: page.pageSize,
            }
        } finally {
            cursorLoading.value = false
        }
    }

    const tableHasMore = computed(() => Boolean(tableData.value.hasMore && tableData.value.cursorId))

    const viewOptions = computed(() => resolveTableViewOptions(tab.tableName))

    return {
        tableData,
        tableProperties,
        viewOptions,
        tableHasMore,
        cursorLoading,
        loadMore,
        loading,
        mutating,
        loadError,
        canDelete,
        canUpdate,
        connectionWritable,
        gridEditable,
        effectiveCanDelete,
        effectiveCanUpdate,
        editDisabledHint,
        primaryKeyColumns,
        submitChanges,
        refresh: load,
    }
}
