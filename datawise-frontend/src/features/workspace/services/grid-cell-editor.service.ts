import type {TableColumn} from '@/core/types'
import type {TableColumnDetail} from '@/shared/api/types'
import {formatCellFullValue, isExpandableCellValue} from '@/core/utils/cell-value-format'
import {resolveGridColumnTypeLabel} from '@/core/components/data-grid-column-meta'

export type GridCellEditorKind = 'text' | 'longText' | 'json' | 'binary'

const JSON_TYPE_RE = /\bjson\b/i
const BINARY_TYPE_RE = /\b(blob|binary|bytea|varbinary|longblob|mediumblob|tinyblob|image|bfile|raw)\b/i
const LOB_TEXT_TYPE_RE = /\b(text|clob|longtext|mediumtext|tinytext|ntext)\b/i

function looksLikeJsonText(text: string): boolean {
    const trimmed = text.trim()
    return (trimmed.startsWith('{') && trimmed.endsWith('}'))
        || (trimmed.startsWith('[') && trimmed.endsWith(']'))
}

/** 根据列类型与单元格值推断专用编辑器种类 */
export function resolveGridCellEditorKind(
    column: TableColumn,
    columnDetails: TableColumnDetail[] = [],
    value?: unknown,
): GridCellEditorKind {
    const typeLabel = resolveGridColumnTypeLabel(column, columnDetails)
    if (BINARY_TYPE_RE.test(typeLabel)) return 'binary'
    if (JSON_TYPE_RE.test(typeLabel)) return 'json'
    if (LOB_TEXT_TYPE_RE.test(typeLabel)) return 'longText'

    if (value != null) {
        const full = formatCellFullValue(value)
        if (looksLikeJsonText(full)) return 'json'
        if (isExpandableCellValue(value) || full.length > 96) return 'longText'
    }
    return 'text'
}

export function shouldUseDedicatedCellEditor(
    column: TableColumn,
    columnDetails: TableColumnDetail[] = [],
    value?: unknown,
): boolean {
    const kind = resolveGridCellEditorKind(column, columnDetails, value)
    return kind === 'longText' || kind === 'json' || kind === 'binary'
}

export function formatJsonEditorText(raw: string): string {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    const parsed = JSON.parse(trimmed) as unknown
    return JSON.stringify(parsed, null, 2)
}

export function validateJsonEditorText(raw: string): string | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
        JSON.parse(trimmed)
        return null
    } catch {
        return 'invalidJson'
    }
}
