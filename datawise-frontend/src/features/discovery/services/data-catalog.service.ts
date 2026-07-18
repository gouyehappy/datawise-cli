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

export interface LineageImpactSource {
    connectionId: string
    database: string
    name: string
}

export interface RelatedTableChoice {
    /** Original relatedTables entry. */
    raw: string
    /** Normalized table name for the impact API. */
    name: string
    /** Display label (usually the raw entry). */
    label: string
}

/** Unique related-table choices for a metric hit (deduped by normalized name). */
export function listRelatedTableChoices(hit: DiscoveryHit | null | undefined): RelatedTableChoice[] {
    if (!hit || hit.kind !== 'metric') return []
    const database = hit.database?.trim() ?? ''
    const seen = new Set<string>()
    const out: RelatedTableChoice[] = []
    for (const item of hit.relatedTables ?? []) {
        const raw = item.trim()
        if (!raw) continue
        const name = normalizeRelatedTableName(raw, database)
        if (!name) continue
        const key = name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push({raw, name, label: raw})
    }
    return out
}

export function needsRelatedTablePicker(hit: DiscoveryHit | null | undefined): boolean {
    return listRelatedTableChoices(hit).length > 1
}

/**
 * Resolve the physical object used for view-model impact / lineage jump.
 * For metrics with several relatedTables, pass `relatedTable` (raw or normalized name)
 * after the user picks one; otherwise the first choice is used.
 */
export function resolveLineageImpactSource(
    hit: DiscoveryHit | null | undefined,
    relatedTable?: string | null,
): LineageImpactSource | null {
    if (!hit) return null
    const connectionId = hit.connectionId?.trim()
    const database = hit.database?.trim()
    if (!connectionId || !database) return null

    if (hit.kind === 'table' || hit.kind === 'view') {
        const name = hit.name?.trim()
        return name ? {connectionId, database, name} : null
    }

    if (hit.kind === 'metric') {
        const choices = listRelatedTableChoices(hit)
        if (!choices.length) return null
        let chosen = choices[0]
        const want = relatedTable?.trim().toLowerCase()
        if (want) {
            const match = choices.find(
                (item) => item.raw.toLowerCase() === want || item.name.toLowerCase() === want,
            )
            if (!match) return null
            chosen = match
        }
        return {connectionId, database, name: chosen.name}
    }

    return null
}

/** Strip db/schema prefix when relatedTables stores qualified names. */
export function normalizeRelatedTableName(raw: string, database: string): string {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    const parts = trimmed.split('.').map((part) => part.trim()).filter(Boolean)
    if (parts.length <= 1) return parts[0] ?? ''
    const db = database.trim().toLowerCase()
    if (parts[0].toLowerCase() === db) {
        return parts.slice(1).join('.')
    }
    return parts[parts.length - 1]
}

export function canJumpLineage(hit: DiscoveryHit | null | undefined): boolean {
    return resolveLineageImpactSource(hit) != null
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
