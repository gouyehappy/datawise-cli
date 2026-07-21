import type {
    ApiResponse,
    CliConfig,
    ExecuteSqlRequest,
    ExecuteSqlResult,
    MigrationBatchReport,
    TableMigrationBatchRequest,
} from './types.js'

export class DatawiseApiError extends Error {
    readonly status: number

    constructor(status: number, message: string) {
        super(message)
        this.name = 'DatawiseApiError'
        this.status = status
    }
}

export class DatawiseClient {
    constructor(private readonly config: CliConfig) {
    }

    async migrateBatch(request: TableMigrationBatchRequest): Promise<MigrationBatchReport> {
        return this.postJson<MigrationBatchReport>('/api/migration/batch', request)
    }

    async executeSql(request: ExecuteSqlRequest): Promise<ExecuteSqlResult> {
        return this.postJson<ExecuteSqlResult>('/api/sql/execute', request)
    }

    async getConfigMigrationStatus(): Promise<import('./types.js').LegacyConfigMigrationStatus> {
        return this.getJson('/api/system/config-migration')
    }

    async applyConfigMigration(): Promise<import('./types.js').LegacyConfigMigrationStatus> {
        return this.postJson('/api/system/config-migration/apply', {})
    }

    private async getJson<T>(path: string): Promise<T> {
        return this.requestJson<T>('GET', path)
    }

    private async postJson<T>(path: string, body: unknown): Promise<T> {
        return this.requestJson<T>('POST', path, body)
    }

    private async requestJson<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
        const url = `${this.config.server}${path}`
        const headers: Record<string, string> = {
            'X-DW-Api-Token': this.config.token,
        }
        if (method === 'POST') {
            headers['Content-Type'] = 'application/json'
        }
        const response = await fetch(url, {
            method,
            headers,
            body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
        })

        let payload: ApiResponse<T> | null = null
        try {
            payload = await response.json() as ApiResponse<T>
        } catch {
            throw new DatawiseApiError(response.status, `Invalid JSON response from ${url}`)
        }

        if (!response.ok || payload.code !== 0 || payload.data == null) {
            const message = payload.msg?.trim() || `Request failed (${response.status})`
            throw new DatawiseApiError(response.status, message)
        }
        return payload.data
    }
}
