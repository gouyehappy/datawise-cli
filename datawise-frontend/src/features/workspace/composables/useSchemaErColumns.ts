import {computed, ref, watch, type ComputedRef, type Ref} from 'vue'
import type {WorkspaceTab} from '@/core/types'
import type {SchemaRelationsResult, TableColumnDetail} from '@/shared/api/types'
import {tableDetailApi} from '@/api'
import type {TableRelationGraph} from '@/features/workspace/services/table-relation-graph.service'
import {enrichSchemaErGraphWithColumns} from '@/features/workspace/services/schema-relation-graph-columns.service'

const BATCH_SIZE = 6

async function mapInBatches<T, R>(
    items: T[],
    batchSize: number,
    mapper: (item: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = []
    for (let index = 0; index < items.length; index += batchSize) {
        const batch = items.slice(index, index + batchSize)
        const batchResults = await Promise.all(batch.map(mapper))
        results.push(...batchResults)
    }
    return results
}

export function useSchemaErColumns(
    tab: WorkspaceTab,
    graph: ComputedRef<TableRelationGraph>,
    schema: Ref<SchemaRelationsResult> | ComputedRef<SchemaRelationsResult>,
    databaseName: ComputedRef<string | undefined>,
) {
    const columnsByTable = ref<Map<string, TableColumnDetail[]>>(new Map())
    const commentsByTable = ref<Map<string, string>>(new Map())
    const loadingColumns = ref(false)
    const columnsError = ref<string | null>(null)

    watch(
        () => [graph.value.nodes.map((node) => node.tableName).join('\0'), tab.connectionId, databaseName.value] as const,
        async ([, connectionId]) => {
            columnsError.value = null
            columnsByTable.value = new Map()
            commentsByTable.value = new Map()
            if (!connectionId || !graph.value.nodes.length) return

            loadingColumns.value = true
            try {
                const entries = await mapInBatches(
                    graph.value.nodes,
                    BATCH_SIZE,
                    async (node) => {
                        try {
                            const properties = await tableDetailApi.fetchProperties(node.tableName, {
                                connectionId,
                                database: databaseName.value,
                            })
                            return {
                                tableName: node.tableName,
                                columns: properties.columns,
                                comment: properties.comment?.trim() || '',
                            }
                        } catch {
                            return {
                                tableName: node.tableName,
                                columns: [] as TableColumnDetail[],
                                comment: '',
                            }
                        }
                    },
                )
                columnsByTable.value = new Map(entries.map((entry) => [entry.tableName, entry.columns]))
                commentsByTable.value = new Map(
                    entries
                        .filter((entry) => entry.comment)
                        .map((entry) => [entry.tableName, entry.comment]),
                )
            } catch (error) {
                columnsError.value = error instanceof Error ? error.message : 'Failed to load table columns'
            } finally {
                loadingColumns.value = false
            }
        },
        {immediate: true},
    )

    const enrichedGraph = computed(() =>
        enrichSchemaErGraphWithColumns(
            graph.value,
            schema.value,
            columnsByTable.value,
            commentsByTable.value,
        ),
    )

    return {
        enrichedGraph,
        loadingColumns,
        columnsError,
    }
}
