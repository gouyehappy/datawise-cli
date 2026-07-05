import {computed, ref, watch} from 'vue'
import {storeToRefs} from 'pinia'
import type {WorkspaceTab} from '@/core/types'
import {findParentConnectionId} from '@/core/utils/tree'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {isCatalogSchemaDbType} from '@/features/explorer/services/explorer-lazy-load'
import {
    extractDataSources,
    findDataSource,
    filterSelectableDataSources,
    includePinnedDataSource,
    pickDefaultDataSource,
    resolveBoundInstanceId,
} from '@/features/explorer/utils/data-sources'
import {getBoundConsoleSqlFile} from '@/features/workspace/services/console-tab-title'

/** 控制台 Tab 的数据源 / 实例选择，与 explorer 树联动 */
export function useConsoleConnectionContext(tab: WorkspaceTab) {
    const explorer = useExplorerStore()
    const {connectionHealthById} = storeToRefs(explorer)

    const workspaceBound = computed(() => Boolean(getBoundConsoleSqlFile(tab)))

    const dataSources = computed(() => extractDataSources(explorer.tree))
    const selectableDataSources = computed(() =>
        filterSelectableDataSources(dataSources.value, connectionHealthById.value),
    )
    const connectionId = ref(tab.connectionId ?? '')
    const instanceId = ref<string | null>(tab.instanceId ?? null)

    const selected = explorer.selectedNode
    if (!workspaceBound.value) {
        if (selected?.type === 'connection' && !tab.connectionId) {
            connectionId.value = selected.id
        }
        if (selected?.type === 'database' && !tab.instanceId && !tab.database) {
            const parentConnectionId = findParentConnectionId(explorer.tree, selected.id)
            const connection = parentConnectionId ? explorer.findNode(parentConnectionId) : undefined
            if (parentConnectionId && !isCatalogSchemaDbType(connection?.dbType)) {
                connectionId.value = parentConnectionId
                instanceId.value = selected.id
            }
        }
    }

    const source = computed(() =>
        connectionId.value ? findDataSource(dataSources.value, connectionId.value) : undefined,
    )
    const activeInstance = computed(() =>
        source.value?.instances.find((item) => item.id === instanceId.value) ?? null,
    )

    const ctxDataSources = computed(() => {
        if (!workspaceBound.value) return selectableDataSources.value
        return includePinnedDataSource(
            dataSources.value,
            selectableDataSources.value,
            connectionHealthById.value,
            tab.connectionId || connectionId.value,
        )
    })

    watch(
        [dataSources, connectionHealthById],
        () => {
            if (workspaceBound.value) {
                const pinnedId = tab.connectionId || connectionId.value
                if (pinnedId) {
                    connectionId.value = pinnedId
                }
                const activeSource = connectionId.value
                    ? findDataSource(dataSources.value, connectionId.value)
                    : undefined
                if (isCatalogSchemaDbType(activeSource?.dbType)) {
                    return
                }
                instanceId.value = resolveBoundInstanceId({
                    instances: activeSource?.instances ?? [],
                    tabInstanceId: instanceId.value ?? tab.instanceId,
                    tabDatabase: tab.database,
                    preserveBinding: true,
                })
                return
            }

            const sources = selectableDataSources.value
            const preferredId = connectionId.value || tab.connectionId
            const next = pickDefaultDataSource(dataSources.value, connectionHealthById.value, preferredId)

            if (next) {
                connectionId.value = next.id
            } else if (!sources.length) {
                connectionId.value = ''
            }

            const activeSource = connectionId.value
                ? findDataSource(dataSources.value, connectionId.value)
                : undefined
            if (isCatalogSchemaDbType(activeSource?.dbType)) {
                return
            }
            instanceId.value = resolveBoundInstanceId({
                instances: activeSource?.instances ?? [],
                tabInstanceId: instanceId.value ?? tab.instanceId,
                tabDatabase: tab.database,
            })
        },
        {immediate: true, deep: true},
    )

    return {
        connectionId,
        instanceId,
        dataSources: ctxDataSources,
        source,
        activeInstance,
        workspaceBound,
    }
}
