import {api} from '@/shared/api'
import type {TableDataFetchOptions} from '@/shared/api/types'

export const tableDataApi = {
    fetch: (tableName: string, options?: TableDataFetchOptions) =>
        api.tableData.fetch(tableName, options),
    insertRow: (
        tableName: string,
        request: Parameters<typeof api.tableData.insertRow>[1],
    ) => api.tableData.insertRow(tableName, request),
    updateRow: (
        tableName: string,
        request: Parameters<typeof api.tableData.updateRow>[1],
    ) => api.tableData.updateRow(tableName, request),
    deleteRow: (
        tableName: string,
        request: Parameters<typeof api.tableData.deleteRow>[1],
    ) => api.tableData.deleteRow(tableName, request),
}
