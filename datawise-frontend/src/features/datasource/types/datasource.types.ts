export interface DatasourceDefinition {
    id: string
    label: string
    primary: boolean
    defaultPort: string
    jdbcDriverRequired: boolean
    defaultDriverMaven?: string
    defaultDriverClass?: string
    capabilities: string[]
    /** 与后端 DbType.getQuote() 一致 */
    identifierQuote?: string
}

export interface JdbcDriverResolveResult {
    mavenCoordinates: string
    driverClass: string
    localPath: string
    downloaded: boolean
    cached: boolean
}

export interface ConnectorPluginLoadFailure {
    jarName: string
    reason: string
}

export interface DatasourceCatalogBundle {
    datasources: DatasourceDefinition[]
    loadedPluginJars: string[]
    pluginLoadFailures: ConnectorPluginLoadFailure[]
}

export interface ConnectorMarketEntry {
    id: string
    label: string
    primary: boolean
    available: boolean
    capabilities: string[]
    installHint?: string | null
    version?: string | null
    jarName?: string | null
    /** bundled | verified | mismatch | unsigned | missing | none */
    integrityStatus?: string | null
    downloadUrl?: string | null
}

export interface ConnectorMarketManifestSummary {
    schemaVersion: number
    updatedAt?: string
    channel?: string
    pluginCount: number
}

export interface ConnectorMarketBundle {
    connectors: ConnectorMarketEntry[]
    loadedPluginJars: string[]
    pluginLoadFailures: ConnectorPluginLoadFailure[]
    manifest?: ConnectorMarketManifestSummary | null
}
