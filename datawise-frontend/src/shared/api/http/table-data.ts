import type {TableDataApi, TableDataResult, TableRowMutateRequest, TableRowMutateResult} from '@/shared/api/types'
import {getJson, postJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

export function createHttpTableDataApi(): TableDataApi {
    return {
        fetch: async (tableName, options) => {
            if (!tableName?.trim()) {
                return {columns: [], rows: []}
            }
            const connectionId = options?.connectionId
            if (!connectionId?.trim()) {
                throw new Error('connectionId is required')
            }
            return getJson<TableDataResult>(
                API_PATHS.tableData(tableName, {
                    connectionId,
                    database: options?.database,
                    maxRows: options?.maxRows,
                    cursorId: options?.cursorId,
                }),
            )
        },
        insertRow: (tableName, request) =>
            postJson<TableRowMutateResult>(API_PATHS.tableRows(tableName), request),
        updateRow: (tableName, request) =>
            postJson<TableRowMutateResult>(API_PATHS.tableRowsUpdate(tableName), request),
        deleteRow: (tableName, request) =>
            postJson<TableRowMutateResult>(API_PATHS.tableRowsDelete(tableName), request),
    }
}
