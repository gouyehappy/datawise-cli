import type {DatasourcesApi} from '@/shared/api/types'
import type {
    ConnectorMarketEntry,
    DatasourceDefinition,
    InstallConnectorBatchResult,
    InstallConnectorPluginResult,
    JdbcDriverCatalog,
    JdbcDriverResolveResult,
    UninstallConnectorPluginResult,
} from '@/features/datasource/types/datasource.types'
import {deleteJson, getJson, postJson} from '@/shared/api/http/request'
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
            postJson<JdbcDriverResolveResult>(API_PATHS.datasources.resolveDriver, request, {silent: true}),

        installDriver: async (request) =>
            postJson<JdbcDriverResolveResult>(API_PATHS.datasources.driversInstall, request, {silent: true}),

        listDrivers: async () =>
            getJson<JdbcDriverCatalog>(API_PATHS.datasources.drivers),

        deleteDriver: async (relativePath) =>
            deleteJson<{deleted: boolean; relativePath: string}>(
                API_PATHS.datasources.deleteDriver(relativePath),
            ),

        deleteDriverBundle: async (bundleDir) =>
            deleteJson<{deletedCount: number; bundleDir: string}>(
                API_PATHS.datasources.deleteDriverBundle(bundleDir),
            ),

        deleteDriverFamily: async (familyId) =>
            deleteJson<{deletedCount: number; familyId: string}>(
                API_PATHS.datasources.deleteDriverFamily(familyId),
            ),

        installFromMarket: async (connectorId) =>
            postJson<InstallConnectorPluginResult>(API_PATHS.datasources.marketInstall, {connectorId}),

        installFromMarketBatch: async (connectorIds) =>
            postJson<InstallConnectorBatchResult>(API_PATHS.datasources.marketInstallBatch, {connectorIds}),

        uninstallFromMarket: async (connectorId) =>
            deleteJson<UninstallConnectorPluginResult>(
                API_PATHS.datasources.marketUninstall(connectorId),
            ),

        cleanupRedundantPlugins: async () =>
            postJson<{
                deletedCount: number
                deletedJars: string[]
                failedJars: string[]
                message: string
            }>(API_PATHS.datasources.marketCleanupRedundant, {}),

        reloadPlugins: async () =>
            postJson<{
                loadedJarCount: number
                loadedConnectorIds: string[]
                failures: Array<{jarName: string; reason: string}>
            }>(API_PATHS.datasources.pluginsReload, {}),
    }
}
