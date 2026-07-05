import {computed, ref, watch} from 'vue'
import type {TreeNode, WorkspaceTab} from '@/core/types'
import {findDatabaseLabel} from '@/core/utils/tree'
import type {TableDdlResult, TablePropertiesResult} from '@/shared/api/types'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {tableDetailApi} from '@/api'

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

export function useTableDetail(
    tab: WorkspaceTab,
    options?: { shouldLoadDdl?: () => boolean },
) {
    const explorer = useExplorerStore()
    const properties = ref<TablePropertiesResult>(EMPTY_PROPERTIES)
    const ddl = ref<TableDdlResult | null>(null)
    const loadingProperties = ref(false)
    const loadingDdl = ref(false)
    const propertiesError = ref<string | null>(null)
    const ddlError = ref<string | null>(null)

    const databaseName = computed(() => resolveDatabaseName(tab, explorer.tree))

    async function loadProperties() {
        propertiesError.value = null
        if (!tab.tableName?.trim() || !tab.connectionId) {
            properties.value = EMPTY_PROPERTIES
            return
        }
        loadingProperties.value = true
        try {
            properties.value = await tableDetailApi.fetchProperties(tab.tableName, {
                connectionId: tab.connectionId,
                database: databaseName.value,
                kind: tab.relationKind ?? 'table',
            })
        } catch (error) {
            properties.value = EMPTY_PROPERTIES
            propertiesError.value = error instanceof Error ? error.message : 'Failed to load table properties'
        } finally {
            loadingProperties.value = false
        }
    }

    async function loadDdl() {
        ddlError.value = null
        if (!tab.tableName?.trim() || !tab.connectionId) {
            ddl.value = null
            return
        }
        if (loadingDdl.value) return
        loadingDdl.value = true
        try {
            ddl.value = await tableDetailApi.fetchDdl(tab.tableName, {
                connectionId: tab.connectionId,
                database: databaseName.value,
                kind: tab.relationKind ?? 'table',
            })
        } catch (error) {
            ddl.value = null
            ddlError.value = error instanceof Error ? error.message : 'Failed to load DDL'
        } finally {
            loadingDdl.value = false
        }
    }

    watch(
        () =>
            [
                tab.tableName,
                tab.connectionId,
                tab.instanceId,
                tab.database,
                tab.relationKind,
                databaseName.value,
                explorer.treeReady,
            ] as const,
        () => {
            void loadProperties()
            ddl.value = null
            ddlError.value = null
            if (options?.shouldLoadDdl?.()) {
                void loadDdl()
            }
        },
        {immediate: true, deep: true},
    )

    return {
        properties,
        ddl,
        loadingProperties,
        loadingDdl,
        propertiesError,
        ddlError,
        loadProperties,
        loadDdl,
    }
}
