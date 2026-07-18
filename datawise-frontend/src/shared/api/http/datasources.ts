import type {DatasourcesApi} from '@/shared/api/types'
import type {
    ConnectorMarketEntry,
    DatasourceDefinition,
    JdbcDriverResolveResult,
} from '@/features/datasource/types/datasource.types'
import {getJson, postJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

type DatasourcesListResponse = {
    datasources: DatasourceDefinition[]
    loadedPluginJars?: string[]
    pluginLoadFailures?: Array<{jarName: string; reason: string}>
}

type ConnectorMarketResponse = {
    connectors: ConnectorMarketEntry[]
    loadedPluginJars?: string[]
    pluginLoadFailures?: Array<{jarName: string; reason: string}>
    manifest?: {
        schemaVersion: number
        updatedAt?: string
        channel?: string
        pluginCount: number
    } | null
}

export function createHttpDatasourcesApi(): DatasourcesApi {
    return {
        list: async () => {
            return getJson<DatasourcesListResponse>(API_PATHS.datasources.list)
        },

        market: async () => {
            return getJson<ConnectorMarketResponse>(API_PATHS.datasources.market)
        },

        resolveDriver: async (request) =>
            postJson<JdbcDriverResolveResult>(API_PATHS.datasources.resolveDriver, request),
    }
}
