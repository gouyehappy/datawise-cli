import type {TableColumn, TableRow} from '@/core/types'
import type {TableColumnDetail} from '@/shared/api/types'
import {resolveGridColumnTypeLabel} from '@/core/components/data-grid-column-meta'
import {formatCellFullValue} from '@/core/utils/cell-value-format'
import {columnRowKey, readRowCell} from '@/core/utils/query-result-column'
import {rowMatchesWhereExpression} from '@/features/workspace/services/grid-where-expression.service'

export type GridSortDirection = 'asc' | 'desc'

export const GRID_COLUMN_WIDTH_DEFAULT = 148
export const GRID_COLUMN_WIDTH_MIN = 64
export const GRID_COLUMN_WIDTH_MAX = 720

/** 按字段类型 / 声明长度给出合理默认列宽（用户手动拖拽后以持久化宽度为准） */
export function suggestGridColumnWidth(
    column: TableColumn,
    details: TableColumnDetail[] = [],
): number {
    const typeLabel = resolveGridColumnTypeLabel(column, details).toLowerCase()
    const nameFloor = Math.min(
        220,
        Math.max(GRID_COLUMN_WIDTH_MIN, column.name.length * 8 + 44),
    )
    const declaredLen = parseDeclaredTypeLength(typeLabel)

    let suggested = GRID_COLUMN_WIDTH_DEFAULT
    if (/\b(bool|boolean|bit)\b/.test(typeLabel)) {
        suggested = 72
    } else if (/\btinyint\b/.test(typeLabel)) {
        suggested = 76
    } else if (/\b(smallint|year)\b/.test(typeLabel)) {
        suggested = 84
    } else if (/\b(bigint|bigserial)\b/.test(typeLabel)) {
        suggested = 108
    } else if (/\b(int|integer|serial|mediumint)\b/.test(typeLabel)) {
        suggested = 92
    } else if (/\b(float|double|real|money)\b/.test(typeLabel)) {
        suggested = 112
    } else if (/\b(decimal|numeric|number)\b/.test(typeLabel)) {
        suggested = declaredLen != null
            ? Math.min(168, Math.max(100, 90 + declaredLen * 7))
            : 120
    } else if (/\b(datetime|timestamp)/.test(typeLabel)) {
        suggested = declaredLen != null && declaredLen >= 3 ? 188 : 172
    } else if (/\bdate\b/.test(typeLabel) && !/\bdatetime\b/.test(typeLabel)) {
        suggested = 112
    } else if (/\btime\b/.test(typeLabel) && !/\bdatetime\b/.test(typeLabel) && !/\btimestamp\b/.test(typeLabel)) {
        suggested = 108
    } else if (/\b(uuid|uniqueidentifier|guid)\b/.test(typeLabel)) {
        suggested = 280
    } else if (/\b(json|jsonb|xml)\b/.test(typeLabel)) {
        suggested = 220
    } else if (/\b(longtext|mediumtext|tinytext|text|clob|nclob|blob|bytea)\b/.test(typeLabel)) {
        suggested = 200
    } else if (/\b(char|varchar|nvarchar|nchar|character varying|character)\b/.test(typeLabel)) {
        if (declaredLen == null) {
            suggested = 148
        } else if (declaredLen <= 8) {
            suggested = 88
        } else if (declaredLen <= 16) {
            suggested = 120
        } else if (declaredLen <= 32) {
            suggested = 148
        } else if (declaredLen <= 64) {
            suggested = 180
        } else if (declaredLen <= 128) {
            suggested = 220
        } else if (declaredLen <= 255) {
            suggested = 260
        } else {
            suggested = 280
        }
    } else if (/\benum\b/.test(typeLabel)) {
        suggested = 128
    }

    return clampColumnWidth(Math.max(suggested, nameFloor))
}

function parseDeclaredTypeLength(typeLabel: string): number | null {
    const match = typeLabel.match(/\(\s*(\d+)(?:\s*,\s*\d+)?\s*\)/)
    if (!match) return null
    const value = Number(match[1])
    return Number.isFinite(value) ? value : null
}

export interface GridViewState {
    columnFilters: Record<string, string>
    /** WHERE SQL 片段（优先于 columnFilters） */
    whereExpression?: string
    sortColumn: string | null
    sortDirection: GridSortDirection | null
    /** 列宽（按 columnRowKey） */
    columnWidths: Record<string, number>
    /** 列展示顺序（columnRowKey 列表）；空则跟随数据源顺序 */
    columnOrder: string[]
}

export const GRID_VIEW_STATE_STORAGE_KEY = 'dw-grid-view-state-v1'

export function createEmptyGridViewState(): GridViewState {
    return {
        columnFilters: {},
        whereExpression: '',
        sortColumn: null,
        sortDirection: null,
        columnWidths: {},
        columnOrder: [],
    }
}

export function gridViewStateIsActive(state: GridViewState): boolean {
    const hasExpression = Boolean(state.whereExpression?.trim())
    const hasFilters = Object.values(state.columnFilters).some((value) => value.trim().length > 0)
    return hasExpression || hasFilters || Boolean(state.sortColumn && state.sortDirection)
}

export function cellMatchesFilter(cellText: string, filter: string): boolean {
    const query = filter.trim().toLowerCase()
    if (!query) return true
    return cellText.toLowerCase().includes(query)
}

export function compareCellValues(left: unknown, right: unknown): number {
    if (left == null && right == null) return 0
    if (left == null) return 1
    if (right == null) return -1
    if (typeof left === 'number' && typeof right === 'number') {
        return left - right
    }
    return formatCellFullValue(left).localeCompare(
        formatCellFullValue(right),
        undefined,
        {numeric: true, sensitivity: 'base'},
    )
}

export function applyGridViewStateToRows(
    rows: TableRow[],
    columns: TableColumn[],
    state: GridViewState,
): TableRow[] {
    let result = rows

    const whereExpression = state.whereExpression?.trim() ?? ''
    if (whereExpression) {
        result = result.filter((row) =>
            rowMatchesWhereExpression(whereExpression, (columnName) => {
                const column = columns.find(
                    (item) =>
                        item.name.toLowerCase() === columnName.toLowerCase()
                        || columnRowKey(item).toLowerCase() === columnName.toLowerCase(),
                )
                if (!column) return undefined
                return readRowCell(row, column)
            }),
        )
    } else {
        const activeFilters = Object.entries(state.columnFilters).filter(([, value]) => value.trim())
        if (activeFilters.length) {
            result = result.filter((row) =>
                activeFilters.every(([columnKey, filter]) => {
                    const column = columns.find(
                        (item) => columnRowKey(item) === columnKey || item.name === columnKey,
                    )
                    if (!column) return true
                    const text = formatCellFullValue(readRowCell(row, column))
                    return cellMatchesFilter(text, filter)
                }),
            )
        }
    }

    if (state.sortColumn && state.sortDirection) {
        const column = columns.find(
            (item) => columnRowKey(item) === state.sortColumn || item.name === state.sortColumn,
        )
        if (column) {
            const direction = state.sortDirection === 'asc' ? 1 : -1
            result = [...result].sort(
                (left, right) =>
                    compareCellValues(readRowCell(left, column), readRowCell(right, column)) * direction,
            )
        }
    }

    return result
}

function normalizeColumnWidths(raw: unknown): Record<string, number> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const widths: Record<string, number> = {}
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const width = typeof value === 'number' ? value : Number(value)
        if (!Number.isFinite(width)) continue
        widths[key] = clampColumnWidth(width)
    }
    return widths
}

function normalizeColumnOrder(raw: unknown): string[] {
    if (!Array.isArray(raw)) return []
    return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function clampColumnWidth(width: number): number {
    return Math.min(GRID_COLUMN_WIDTH_MAX, Math.max(GRID_COLUMN_WIDTH_MIN, Math.round(width)))
}

/** 按持久化顺序重排列；未知 key 追加在末尾 */
export function resolveDisplayColumns(
    columns: TableColumn[],
    columnOrder: string[] | undefined,
): TableColumn[] {
    if (!columnOrder?.length) return columns
    const byKey = new Map(columns.map((column) => [columnRowKey(column), column]))
    const ordered: TableColumn[] = []
    const used = new Set<string>()
    for (const key of columnOrder) {
        const column = byKey.get(key)
        if (!column || used.has(key)) continue
        ordered.push(column)
        used.add(key)
    }
    for (const column of columns) {
        const key = columnRowKey(column)
        if (used.has(key)) continue
        ordered.push(column)
    }
    return ordered
}

export function setGridColumnWidth(
    state: GridViewState,
    columnKey: string,
    width: number,
): GridViewState {
    return {
        ...state,
        columnWidths: {
            ...state.columnWidths,
            [columnKey]: clampColumnWidth(width),
        },
    }
}

export function moveGridColumnOrder(
    state: GridViewState,
    columns: TableColumn[],
    fromKey: string,
    toKey: string,
): GridViewState {
    if (fromKey === toKey) return state
    const current = resolveDisplayColumns(columns, state.columnOrder).map((column) => columnRowKey(column))
    const fromIndex = current.indexOf(fromKey)
    const toIndex = current.indexOf(toKey)
    if (fromIndex < 0 || toIndex < 0) return state
    const next = [...current]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    return {...state, columnOrder: next}
}

export function normalizeGridViewState(raw: unknown): GridViewState {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return createEmptyGridViewState()
    }
    const record = raw as Record<string, unknown>
    const columnFilters: Record<string, string> = {}
    if (record.columnFilters && typeof record.columnFilters === 'object' && !Array.isArray(record.columnFilters)) {
        for (const [key, value] of Object.entries(record.columnFilters)) {
            if (typeof value === 'string') columnFilters[key] = value
        }
    }
    const sortColumn = typeof record.sortColumn === 'string' && record.sortColumn.trim()
        ? record.sortColumn
        : null
    const sortDirection = record.sortDirection === 'asc' || record.sortDirection === 'desc'
        ? record.sortDirection
        : null
    return {
        columnFilters,
        whereExpression: typeof record.whereExpression === 'string' ? record.whereExpression : '',
        sortColumn: sortDirection ? sortColumn : null,
        sortDirection: sortColumn ? sortDirection : null,
        columnWidths: normalizeColumnWidths(record.columnWidths),
        columnOrder: normalizeColumnOrder(record.columnOrder),
    }
}

export function toggleGridSort(state: GridViewState, columnKey: string): GridViewState {
    if (state.sortColumn !== columnKey || !state.sortDirection) {
        return {...state, sortColumn: columnKey, sortDirection: 'asc'}
    }
    if (state.sortDirection === 'asc') {
        return {...state, sortColumn: columnKey, sortDirection: 'desc'}
    }
    return {...state, sortColumn: null, sortDirection: null}
}

export function setGridColumnFilter(
    state: GridViewState,
    columnKey: string,
    value: string,
): GridViewState {
    const nextFilters = {...state.columnFilters}
    const trimmed = value.trim()
    if (trimmed) {
        nextFilters[columnKey] = value
    } else {
        delete nextFilters[columnKey]
    }
    return {...state, columnFilters: nextFilters}
}

/** 清除筛选/排序，保留列宽与顺序 */
export function clearGridViewState(state?: GridViewState): GridViewState {
    return {
        columnFilters: {},
        whereExpression: '',
        sortColumn: null,
        sortDirection: null,
        columnWidths: state?.columnWidths ?? {},
        columnOrder: state?.columnOrder ?? [],
    }
}
