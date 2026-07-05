import type {TableColumn, TableRow} from '@/core/types'
import {formatCellFullValue} from '@/core/utils/cell-value-format'
import {columnRowKey, readRowCell} from '@/core/utils/query-result-column'

export type GridSortDirection = 'asc' | 'desc'

export interface GridViewState {
    columnFilters: Record<string, string>
    sortColumn: string | null
    sortDirection: GridSortDirection | null
}

export const GRID_VIEW_STATE_STORAGE_KEY = 'dw-grid-view-state-v1'

export function createEmptyGridViewState(): GridViewState {
    return {
        columnFilters: {},
        sortColumn: null,
        sortDirection: null,
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

export function clearGridViewState(): GridViewState {
    return createEmptyGridViewState()
}
