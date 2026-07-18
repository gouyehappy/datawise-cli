import type {DiscoveryHit} from '@/features/platform/types/platform.types'
import type {LineageImpactItem} from '@/features/lineage/types/lineage.types'

/** Prefer a single unambiguous downstream model for one-click lineage jump. */
export function pickLineageJumpTarget(
    impactDownstream: readonly LineageImpactItem[],
    preferredName?: string | null,
): LineageImpactItem | null {
    if (!impactDownstream.length) return null
    const preferred = preferredName?.trim().toLowerCase()
    if (preferred) {
        const exact = impactDownstream.find((item) => item.modelName.trim().toLowerCase() === preferred)
        if (exact) return exact
    }
    if (impactDownstream.length === 1) return impactDownstream[0]
    return null
}

export function discoveryHitRowKey(hit: DiscoveryHit): string {
    return `${hit.kind}|${hit.connectionId}|${hit.database}|${hit.id}|${hit.name}`
}

export function canJumpLineage(hit: DiscoveryHit | null | undefined): boolean {
    if (!hit) return false
    return (hit.kind === 'table' || hit.kind === 'view')
        && Boolean(hit.connectionId?.trim() && hit.database?.trim() && hit.name?.trim())
}

export type DiscoveryFacetKind = DiscoveryHit['kind']

export interface DataCatalogFacets {
    kinds: DiscoveryFacetKind[]
    connectionIds: string[]
    owners: string[]
}

export interface DataCatalogFacetOption {
    value: string
    label: string
    count: number
}

export const EMPTY_DATA_CATALOG_FACETS: DataCatalogFacets = {
    kinds: [],
    connectionIds: [],
    owners: [],
}

export function hasActiveDataCatalogFacets(facets: DataCatalogFacets): boolean {
    return facets.kinds.length > 0
        || facets.connectionIds.length > 0
        || facets.owners.length > 0
}

/** Build facet chip options from the current hit set (counts reflect unfiltered hits). */
export function buildDataCatalogFacetOptions(hits: readonly DiscoveryHit[]): {
    kinds: DataCatalogFacetOption[]
    connections: DataCatalogFacetOption[]
    owners: DataCatalogFacetOption[]
} {
    const kindCounts = new Map<string, number>()
    const connectionCounts = new Map<string, {label: string; count: number}>()
    const ownerCounts = new Map<string, number>()

    for (const hit of hits) {
        kindCounts.set(hit.kind, (kindCounts.get(hit.kind) ?? 0) + 1)
        const connId = hit.connectionId?.trim()
        if (connId) {
            const prev = connectionCounts.get(connId)
            connectionCounts.set(connId, {
                label: hit.connectionLabel?.trim() || connId,
                count: (prev?.count ?? 0) + 1,
            })
        }
        const owner = hit.owner?.trim()
        if (owner) {
            ownerCounts.set(owner, (ownerCounts.get(owner) ?? 0) + 1)
        }
    }

    const kindOrder: DiscoveryFacetKind[] = ['table', 'view', 'metric']
    return {
        kinds: kindOrder
            .filter((kind) => kindCounts.has(kind))
            .map((kind) => ({value: kind, label: kind, count: kindCounts.get(kind) ?? 0})),
        connections: [...connectionCounts.entries()]
            .map(([value, meta]) => ({value, label: meta.label, count: meta.count}))
            .sort((a, b) => a.label.localeCompare(b.label) || b.count - a.count),
        owners: [...ownerCounts.entries()]
            .map(([value, count]) => ({value, label: value, count}))
            .sort((a, b) => a.label.localeCompare(b.label) || b.count - a.count),
    }
}

export function filterDiscoveryHitsByFacets(
    hits: readonly DiscoveryHit[],
    facets: DataCatalogFacets,
): DiscoveryHit[] {
    const kinds = new Set(facets.kinds)
    const connections = new Set(facets.connectionIds)
    const owners = new Set(facets.owners.map((item) => item.trim()).filter(Boolean))
    if (!kinds.size && !connections.size && !owners.size) {
        return [...hits]
    }
    return hits.filter((hit) => {
        if (kinds.size && !kinds.has(hit.kind)) return false
        if (connections.size && !connections.has(hit.connectionId)) return false
        if (owners.size) {
            const owner = hit.owner?.trim() ?? ''
            if (!owner || !owners.has(owner)) return false
        }
        return true
    })
}

export function toggleFacetValue<T extends string>(selected: readonly T[], value: T): T[] {
    return selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
}
