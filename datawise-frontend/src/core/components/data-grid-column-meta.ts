import type {TableColumn} from '@/core/types'
import type {TableColumnDetail} from '@/shared/api/types'

const NUMERIC_TYPE_RE =
    /\b(int|integer|bigint|smallint|tinyint|mediumint|serial|bigserial|decimal|numeric|number|float|double|real|money|bit)\b/i

const DATETIME_TYPE_RE =
    /\b(datetime|timestamp|timestamptz|datetime2|smalldatetime)\b/i
const DATE_TYPE_RE = /\bdate\b/i
const TIME_TYPE_RE = /\b(time|timetz)\b/i

export type GridTemporalKind = 'datetime' | 'date' | 'time'

function detailForColumn(
    column: TableColumn,
    details: TableColumnDetail[],
): TableColumnDetail | undefined {
    return details.find((detail) => detail.name === column.name)
}

/** 表头类型文案：优先 columnDetails.dataType，其次结果列 type */
export function resolveGridColumnTypeLabel(
    column: TableColumn,
    details: TableColumnDetail[] = [],
): string {
    const detail = detailForColumn(column, details)
    const raw = detail?.dataType?.trim() || column.type?.trim() || ''
    return raw
}

export function isGridColumnPrimaryKey(
    column: TableColumn,
    pkColumns: string[] = [],
    details: TableColumnDetail[] = [],
): boolean {
    if (pkColumns.includes(column.name)) return true
    const keyType = detailForColumn(column, details)?.keyType?.trim().toUpperCase() ?? ''
    return keyType === 'PRI' || keyType === 'PRIMARY' || keyType.startsWith('PRIMARY')
}

/** 数值列右对齐启发式（基于类型名） */
export function isGridNumericColumn(
    column: TableColumn,
    details: TableColumnDetail[] = [],
): boolean {
    const typeLabel = resolveGridColumnTypeLabel(column, details)
    if (!typeLabel) return false
    return NUMERIC_TYPE_RE.test(typeLabel)
}

/** 日期 / 时间 / 日期时间列（编辑时弹出选择器） */
export function resolveGridTemporalKind(
    column: TableColumn,
    details: TableColumnDetail[] = [],
): GridTemporalKind | null {
    const typeLabel = resolveGridColumnTypeLabel(column, details)
    if (!typeLabel) return null
    if (DATETIME_TYPE_RE.test(typeLabel)) return 'datetime'
    // 避免 datetime 已被上面匹配；纯 date / time 用词边界
    if (DATE_TYPE_RE.test(typeLabel) && !/\bdatetime\b/i.test(typeLabel)) return 'date'
    if (TIME_TYPE_RE.test(typeLabel) && !/\bdatetime\b/i.test(typeLabel) && !/\btimestamp\b/i.test(typeLabel)) {
        return 'time'
    }
    return null
}

export function isGridTemporalColumn(
    column: TableColumn,
    details: TableColumnDetail[] = [],
): boolean {
    return resolveGridTemporalKind(column, details) != null
}
