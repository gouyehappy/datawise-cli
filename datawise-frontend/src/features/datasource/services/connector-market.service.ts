import {datasourcesApi} from '@/api'
import type {
    ConnectorMarketBundle,
    ConnectorMarketEntry,
} from '@/features/datasource/types/datasource.types'

export async function fetchConnectorMarketBundle(): Promise<ConnectorMarketBundle> {
    const data = await datasourcesApi.market()
    return {
        connectors: data.connectors,
        loadedPluginJars: data.loadedPluginJars ?? [],
        pluginLoadFailures: data.pluginLoadFailures ?? [],
    }
}

export function filterConnectorMarketEntries(
    entries: ConnectorMarketEntry[],
    query: string,
): ConnectorMarketEntry[] {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return entries
    return entries.filter((entry) =>
        entry.label.toLowerCase().includes(normalized)
        || entry.id.toLowerCase().includes(normalized),
    )
}

export function summarizeConnectorMarket(entries: ConnectorMarketEntry[]) {
    const available = entries.filter((entry) => entry.available).length
    return {
        total: entries.length,
        available,
        pending: entries.length - available,
    }
}

export const CONNECTOR_PLUGIN_DIR = 'config/plugins'

export function buildConnectorInstallGuide(entry: ConnectorMarketEntry): string {
    const lines = [
        `# ${entry.label} (${entry.id})`,
        `1. Build or obtain the connector plugin JAR for "${entry.id}".`,
        `2. Copy the JAR into ${CONNECTOR_PLUGIN_DIR}/`,
        '3. Restart the DataWise backend process.',
        '4. Refresh this marketplace page.',
    ]
    if (entry.installHint) {
        lines.push('', entry.installHint)
    }
    return lines.join('\n')
}

export function formatConnectorCapabilityLabel(
    capability: string,
    t: (key: string) => string,
    te: (key: string) => boolean,
): string {
    const key = `plugin.connectorMarket.capabilities.${capability}`
    return te(key) ? t(key) : capability.replaceAll('_', ' ').toLowerCase()
}
