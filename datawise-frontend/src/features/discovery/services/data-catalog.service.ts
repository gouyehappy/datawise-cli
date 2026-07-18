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
