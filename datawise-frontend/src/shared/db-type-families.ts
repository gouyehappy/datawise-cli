import type {DbType} from '@/core/types'

/** Trino / Presto / Hive：Explorer 与 SQL 限定名使用 catalog.schema */
export function isCatalogSchemaDbType(dbType?: DbType): boolean {
    return dbType === 'trino' || dbType === 'presto' || dbType === 'hive'
}
