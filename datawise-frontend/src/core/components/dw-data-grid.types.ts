export type DwDataGridAlign = 'left' | 'right' | 'center'

export interface DwDataGridColumn<T = Record<string, unknown>> {
    /** 行对象字段名 */
    key: string
    label: string
    width?: string
    align?: DwDataGridAlign
    headerClass?: string
    cellClass?: string
    mono?: boolean
    format?: (row: T) => string
}

export interface DwDataGridLabels {
    filter: string
    filterValue?: string
    total: string
    firstPage: string
    prevPage: string
    nextPage: string
    lastPage: string
    empty: string
    noMatch: string
    loading: string
}

export type DwDataGridRowKey<T> = keyof T & string | ((row: T) => string)
