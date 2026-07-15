import type {TableColumn, TableRow} from '@/core/types'
import {formatCellFullValue} from '@/core/utils/cell-value-format'
import {columnRowKey, readRowCell} from '@/core/utils/query-result-column'

export type GridSortDirection = 'asc' | 'desc'

export const GRID_COLUMN_WIDTH_DEFAULT = 120
export const GRID_COLUMN_WIDTH_MIN = 64
export const GRID_COLUMN_WIDTH_MAX = 720

export interface GridViewState {
    columnFilters: Record<string, string>
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
        sortColumn: null,
        sortDirection: null,
        columnWidths: {},
        columnOrder: [],
    }
}

export function gridViewStateIsActive(state: GridViewState): boolean {
    const hasFilters = Object.values(state.columnFilters).some((value) => value.trim().length > 0)
    return hasFilters || Boolean(state.sortColumn && state.sortDirection)
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
    const activeFilters = Object.entries(state.columnFilters).filter(([, value]) => value.trim())
    let result = rows

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
        sortColumn: null,
        sortDirection: null,
        columnWidths: state?.columnWidths ?? {},
        columnOrder: state?.columnOrder ?? [],
    }
}
