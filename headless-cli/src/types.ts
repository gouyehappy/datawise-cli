export interface ApiResponse<T> {
    code: number
    msg: string
    data: T | null
}

export interface TableMigrationBatchTableRequest {
    tableName: string
    createTargetIfMissing?: boolean
}

export interface TableMigrationBatchRequest {
    sourceConnectionId: string
    sourceDatabase?: string
    targetConnectionId: string
    targetDatabase?: string
    tables: TableMigrationBatchTableRequest[]
    whereClause?: string
    batchSize?: number
    throttleMs?: number
    truncateTarget?: boolean
    jobId?: string
    resumeJobId?: string
}

export interface TableMigrationResult {
    tableName: string
    rowsMigrated: number
    batches: number
    durationMs: number
    status: string
    message?: string
}

export interface MigrationBatchReport {
    mode: string
    totalTables: number
    successCount: number
    failedCount: number
    totalRowsMigrated: number
    durationMs: number
    overallStatus: string
    tables: TableMigrationResult[]
}

export interface ExecuteSqlRequest {
    sql: string
    connectionId: string
    database?: string
    maxRows?: number
}

export interface ExecuteSqlResult {
    sql: string
    rowCount: number
    durationMs: number
    columns?: Array<Record<string, unknown>>
    rows?: Array<Record<string, unknown>>
}

export interface CliConfig {
    server: string
    token: string
}
