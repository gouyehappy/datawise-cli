import type {ExecuteSqlResult} from '@/shared/api/types'
import type {QueryResultItem} from '@/features/workspace/types'
import {CURSOR_LOADED_ROWS_MAX} from '@/features/workspace/constants/query-result-limits'

export interface AppendCursorRowsResult<T> {
    rows: T[]
    trimmedTotal: number
}

/** 追加游标分页行并在超过上限时从头部丢弃最早行 */
export function appendCursorRowsWithWindow<T>(
    existingRows: readonly T[],
    pageRows: readonly T[],
    options?: {
        maxRows?: number
        previousTrimmed?: number
    },
): AppendCursorRowsResult<T> {
    const maxRows = options?.maxRows ?? CURSOR_LOADED_ROWS_MAX
    const previousTrimmed = options?.previousTrimmed ?? 0
    const merged = [...existingRows, ...pageRows]
    if (merged.length <= maxRows) {
        return {rows: merged, trimmedTotal: previousTrimmed}
    }
    const drop = merged.length - maxRows
    return {
        rows: merged.slice(drop),
        trimmedTotal: previousTrimmed + drop,
    }
}

export function mergeCursorPageIntoQueryResult(
    item: QueryResultItem,
    page: ExecuteSqlResult,
    options?: {maxRows?: number},
): QueryResultItem {
    const fetchedTotal = item.rows.length + page.rows.length
    const windowed = appendCursorRowsWithWindow(item.rows, page.rows, {
        previousTrimmed: item.cursorTrimmedRows ?? 0,
        maxRows: options?.maxRows ?? CURSOR_LOADED_ROWS_MAX,
    })
    return {
        ...item,
        rows: windowed.rows,
        total: fetchedTotal,
        durationMs: item.durationMs + page.durationMs,
        cursorId: page.cursorId,
        hasMore: page.hasMore ?? false,
        pageOffset: page.pageOffset,
        pageSize: page.pageSize ?? item.pageSize,
        cursorTrimmedRows: windowed.trimmedTotal,
    }
}
