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
}

export interface ConnectorMarketBundle {
    connectors: ConnectorMarketEntry[]
    loadedPluginJars: string[]
    pluginLoadFailures: ConnectorPluginLoadFailure[]
}
