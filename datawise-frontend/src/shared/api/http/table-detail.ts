import type {
    MetadataDocPreviewOptions,
    MetadataDocPreviewResult,
    TableDetailApi,
    TableDdlResult,
    TablePropertiesResult,
    TableRelationsResult,
    SchemaRelationsResult,
    SchemaTablesResult,
    TableSqlExportOptions,
    TableSqlExportResult,
} from '@/shared/api/types'
import {getJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

function requireConnectionId(connectionId?: string): string {
    const trimmed = connectionId?.trim()
    if (!trimmed) {
        throw new Error('connectionId is required')
    }
    return trimmed
}

export function createHttpTableDetailApi(): TableDetailApi {
    return {
        fetchProperties: async (tableName, options) => {
            if (!tableName?.trim()) {
                throw new Error('tableName is required')
            }
            return getJson<TablePropertiesResult>(
                API_PATHS.tableProperties(tableName, {
                    connectionId: requireConnectionId(options?.connectionId),
                    database: options?.database,
                    kind: options?.kind,
                }),
            )
        },
        fetchDdl: async (tableName, options) => {
            if (!tableName?.trim()) {
                throw new Error('tableName is required')
            }
            return getJson<TableDdlResult>(
                API_PATHS.tableDdl(tableName, {
                    connectionId: requireConnectionId(options?.connectionId),
                    database: options?.database,
                    kind: options?.kind,
                }),
            )
        },
        fetchRelations: async (tableName, options) => {
            if (!tableName?.trim()) {
                throw new Error('tableName is required')
            }
            return getJson<TableRelationsResult>(
                API_PATHS.tableRelations(tableName, {
                    connectionId: requireConnectionId(options?.connectionId),
                    database: options?.database,
                }),
            )
        },
        fetchSchemaRelations: async (options) => {
            return getJson<SchemaRelationsResult>(
                API_PATHS.schemaRelations({
                    connectionId: requireConnectionId(options?.connectionId),
                    database: options?.database,
                }),
            )
        },
        fetchSchemaTables: async (options) => {
            return getJson<SchemaTablesResult>(
                API_PATHS.schemaTables({
                    connectionId: requireConnectionId(options?.connectionId),
                    database: options?.database,
                }),
            )
        },
        exportTableSql: async (tableName, options) => {
            if (!tableName?.trim()) {
                throw new Error('tableName is required')
            }
            return getJson<TableSqlExportResult>(
                API_PATHS.tableExportSql(tableName, {
                    connectionId: requireConnectionId(options?.connectionId),
                    database: options?.database,
                    includeData: options?.includeData,
                    maxRows: options?.maxRows,
                }),
            )
        },
        exportDatabaseSql: async (options) => {
            const resolved: TableSqlExportOptions = options ?? {}
            return getJson<TableSqlExportResult>(
                API_PATHS.databaseExportSql({
                    connectionId: requireConnectionId(resolved.connectionId),
                    database: resolved.database,
                    includeData: resolved.includeData,
                    maxRows: resolved.maxRows,
                }),
            )
        },
        previewDatabaseMetadoc: async (options) => {
            const resolved: MetadataDocPreviewOptions = options ?? {}
            return getJson<MetadataDocPreviewResult>(
                API_PATHS.databaseMetadocPreview({
                    connectionId: requireConnectionId(resolved.connectionId),
                    database: resolved.database,
                    format: resolved.format,
                    includeDetails: resolved.includeDetails,
                }),
            )
        },
    }
}
