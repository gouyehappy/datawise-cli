import type {ExecuteSqlResult} from '@/shared/api/types'
import type {QueryResultItem} from '@/features/workspace/types'

export function mergeCursorPageIntoQueryResult(
    item: QueryResultItem,
    page: ExecuteSqlResult,
): QueryResultItem {
    return {
        ...item,
        rows: [...item.rows, ...page.rows],
        total: item.rows.length + page.rows.length,
        durationMs: item.durationMs + page.durationMs,
        cursorId: page.cursorId,
        hasMore: page.hasMore ?? false,
        pageOffset: page.pageOffset,
        pageSize: page.pageSize ?? item.pageSize,
    }
}
