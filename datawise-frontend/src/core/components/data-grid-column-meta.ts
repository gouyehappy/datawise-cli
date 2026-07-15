import type {TableColumn} from '@/core/types'
import type {TableColumnDetail} from '@/shared/api/types'

const NUMERIC_TYPE_RE =
    /\b(int|integer|bigint|smallint|tinyint|mediumint|serial|bigserial|decimal|numeric|number|float|double|real|money|bit)\b/i

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
