import {api} from '@/shared/api'
import type {
    ConnectorMarketEntry,
    JdbcDriverResolveResult,
} from '@/features/datasource/types/datasource.types'

export const datasourcesApi = {
    list: () => api.datasources.list(),
    market: (): Promise<{
        connectors: ConnectorMarketEntry[]
        loadedPluginJars?: string[]
        pluginLoadFailures?: Array<{jarName: string; reason: string}>
    }> => api.datasources.market(),
    resolveDriver: (mavenCoordinates: string, driverClass: string): Promise<JdbcDriverResolveResult> =>
        api.datasources.resolveDriver({mavenCoordinates, driverClass}),
    installFromMarket: (connectorId: string) => api.datasources.installFromMarket(connectorId),
    reloadPlugins: () => api.datasources.reloadPlugins(),
}
