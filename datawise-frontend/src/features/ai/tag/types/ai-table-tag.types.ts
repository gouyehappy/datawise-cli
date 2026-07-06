export interface AiTableTagCatalogItem {
    connectionId: string
    connectionName: string
    database: string
    tableName: string
}

export interface AiTaggedScopeGroup {
    key: string
    connectionId: string
    connectionLabel: string
    database: string
    databaseLabel: string
    dbType: import('@/core/types').DbType
    groupLabel: string
    tables: string[]
}
