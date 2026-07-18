import {describe, expect, it} from 'vitest'
import {
    discoveryHitsToSearchEntries,
    mergeDiscoveryEntries,
} from '@/features/explorer/services/global-object-discovery.service'
import type {GlobalObjectSearchEntry} from '@/features/explorer/services/global-object-search.service'
import type {DiscoveryHit} from '@/features/platform/types/platform.types'

describe('global-object-discovery.service', () => {
    it('maps metric hits with owner', () => {
        const hits: DiscoveryHit[] = [{
            kind: 'metric',
            id: 'm1',
            name: 'gmv',
            qualifiedLabel: 'shop.gmv',
            connectionId: 'c1',
            connectionLabel: 'Shop',
            database: 'shop',
            owner: 'alice',
            subtitle: 'gross',
            score: 100,
        }]
        const entries = discoveryHitsToSearchEntries(hits)
        expect(entries).toHaveLength(1)
        expect(entries[0].kind).toBe('metric')
        expect(entries[0].owner).toBe('alice')
        expect(entries[0].source).toBe('discovery')
    })

    it('dedupes tables already in explorer index', () => {
        const local: GlobalObjectSearchEntry[] = [{
            nodeId: 'n1',
            kind: 'table',
            name: 'orders',
            qualifiedLabel: 'shop.orders',
            connectionId: 'c1',
            connectionLabel: 'Shop',
            database: 'shop',
            source: 'explorer',
            searchText: 'orders',
        }]
        const discovery = discoveryHitsToSearchEntries([
            {
                kind: 'table',
                id: 'cached-orders',
                name: 'orders',
                qualifiedLabel: 'shop.orders',
                connectionId: 'c1',
                connectionLabel: 'Shop',
                database: 'shop',
                score: 80,
            },
            {
                kind: 'metric',
                id: 'm1',
                name: 'gmv',
                qualifiedLabel: 'shop.gmv',
                connectionId: 'c1',
                connectionLabel: 'Shop',
                database: 'shop',
                score: 90,
            },
        ])
        const merged = mergeDiscoveryEntries(local, discovery)
        expect(merged.filter((e) => e.kind === 'table')).toHaveLength(1)
        expect(merged.some((e) => e.kind === 'metric')).toBe(true)
    })
})
