import type {TableColumnDetail, TablePropertiesResult} from '@/shared/api/types'

import {tableDetailApi} from '@/api'

import {fetchAiSchemaTables} from '@/features/ai/datasource/services/ai-schema.service'

import type {

    ColumnSchemaSnapshot,

    SchemaCompareResult,

    SchemaScope,

} from '@/features/schema-compare/types/schema-compare.types'

import {toColumnSnapshot} from '@/features/schema-compare/types/schema-compare.types'

import {buildSchemaMigrateDdl} from '@/features/schema-compare/services/schema-compare-ddl.service'

import {

    diffColumns,

    diffTableNames,

    summarizeTableDiffs,

} from '@/features/schema-compare/services/schema-compare-diff.service'



async function fetchTableColumns(scope: SchemaScope, tableName: string): Promise<ColumnSchemaSnapshot[]> {

    const properties = await tableDetailApi.fetchProperties(tableName, {

        connectionId: scope.connectionId,

        database: scope.database,

    })

    return properties.columns.map(toColumnSnapshot)

}



export async function compareSchemaScopes(

    left: SchemaScope,

    right: SchemaScope,

    options?: { tableFilter?: string[] },

): Promise<SchemaCompareResult> {

    const [leftTables, rightTables] = await Promise.all([

        fetchAiSchemaTables(left.connectionId, left.database),

        fetchAiSchemaTables(right.connectionId, right.database),

    ])



    let tableDiffs = diffTableNames(leftTables, rightTables)

    if (options?.tableFilter?.length) {

        const allowed = new Set(options.tableFilter.map((name) => name.toLowerCase()))

        tableDiffs = tableDiffs.filter((item) => allowed.has(item.tableName.toLowerCase()))

    }



    const createDdls = new Map<string, string>()



    for (const item of tableDiffs) {

        if (item.status === 'unchanged') {

            const [leftColumns, rightColumns] = await Promise.all([

                fetchTableColumns(left, item.tableName),

                fetchTableColumns(right, item.tableName),

            ])

            const columnDiffs = diffColumns(leftColumns, rightColumns)

            item.columnDiffs = columnDiffs

            if (columnDiffs.length) item.status = 'changed'

            continue

        }



        if (item.status === 'added') {

            const ddl = await tableDetailApi.fetchDdl(item.tableName, {

                connectionId: left.connectionId,

                database: left.database,

            })

            createDdls.set(item.tableName, ddl.ddl)

        }

    }



    const ddl = buildSchemaMigrateDdl(tableDiffs, right.dbType, createDdls, right.database)

    const createDdlsRecord: Record<string, string> = {}
    for (const [key, value] of createDdls.entries()) {
        createDdlsRecord[key] = value
    }

    return {

        tableDiffs,

        ddl,

        summary: summarizeTableDiffs(tableDiffs),

        createDdls: createDdlsRecord,

    }

}



export function propertiesToSnapshots(properties: TablePropertiesResult): ColumnSchemaSnapshot[] {

    return properties.columns.map(toColumnSnapshot)

}



export function snapshotsFromColumnDetails(columns: TableColumnDetail[]): ColumnSchemaSnapshot[] {

    return columns.map(toColumnSnapshot)

}



export {diffColumns, diffTableNames} from '@/features/schema-compare/services/schema-compare-diff.service'

