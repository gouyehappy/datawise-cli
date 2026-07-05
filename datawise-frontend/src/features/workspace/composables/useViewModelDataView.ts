import {computed, ref} from 'vue'
import type {WorkspaceTab} from '@/core/types'
import {sqlApi} from '@/api/modules/sql'
import type {TableColumn, TableRow} from '@/core/types'
import {resolveSqlPageSize} from '@/features/settings/services/query-limit.service'

/** 视图模型数据 Tab：游标分页，与 SQL 控制台/表数据共用 maxResultRows 作为每批行数 */
export function useViewModelDataView(tab: WorkspaceTab) {
    const columns = ref<TableColumn[]>([])
    const rows = ref<TableRow[]>([])
    const loading = ref(false)
    const cursorLoading = ref(false)
    const cursorId = ref<string | null>(null)
    const pageSize = ref(resolveSqlPageSize())
    const hasMore = ref(false)
    const errorMessage = ref<string | null>(null)

    const sql = computed(() => tab.viewModelSql?.trim() ?? '')

    async function executeQuery(append = false) {
        if (!tab.connectionId || !sql.value) return
        const isAppend = append && cursorId.value
        if (isAppend) {
            cursorLoading.value = true
        } else {
            loading.value = true
            cursorId.value = null
            hasMore.value = false
            pageSize.value = resolveSqlPageSize()
        }
        errorMessage.value = null
        try {
            const result = isAppend
                ? await sqlApi.fetchCursorPage(cursorId.value!, pageSize.value)
                : await sqlApi.execute(sql.value, {
                    connectionId: tab.connectionId,
                    database: tab.database ?? tab.instanceId ?? undefined,
                    pageSize: pageSize.value,
                })
            const nextColumns = (result.columns ?? []) as TableColumn[]
            const nextRows = (result.rows ?? []) as TableRow[]
            if (isAppend) {
                rows.value = [...rows.value, ...nextRows]
            } else {
                columns.value = nextColumns
                rows.value = nextRows
            }
            cursorId.value = result.cursorId ?? null
            hasMore.value = Boolean(result.cursorId)
        } catch (error) {
            errorMessage.value = error instanceof Error ? error.message : String(error)
            if (!isAppend) {
                columns.value = []
                rows.value = []
            }
        } finally {
            loading.value = false
            cursorLoading.value = false
        }
    }

    async function refresh() {
        await executeQuery(false)
    }

    async function loadMore() {
        if (!hasMore.value || cursorLoading.value) return
        await executeQuery(true)
    }

    return {
        columns,
        rows,
        loading,
        cursorLoading,
        hasMore,
        errorMessage,
        sql,
        refresh,
        loadMore,
        executeQuery,
    }
}
