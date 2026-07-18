import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
    buildDataCatalogFacetOptions,
    canJumpLineage,
    discoveryHitRowKey,
    filterDiscoveryHitsByFacets,
    pickLineageJumpTarget,
    toggleFacetValue,
} from '@/features/discovery/services/data-catalog.service'
import type {DiscoveryHit} from '@/features/platform/types/platform.types'

describe('data-catalog.service', () => {
    const tableHit: DiscoveryHit = {
        kind: 'table',
        id: 'n1',
        name: 'orders',
        qualifiedLabel: 'app.orders',
        connectionId: 'c1',
        connectionLabel: 'prod',
        database: 'app',
        score: 10,
    }

    const hits: DiscoveryHit[] = [
        tableHit,
        {
            kind: 'view',
            id: 'n2',
            name: 'orders_v',
            qualifiedLabel: 'app.orders_v',
            connectionId: 'c1',
            connectionLabel: 'prod',
            database: 'app',
            score: 8,
        },
        {
            kind: 'metric',
            id: 'm1',
            name: 'gmv',
            qualifiedLabel: 'shop.gmv',
            connectionId: 'c2',
            connectionLabel: 'staging',
            database: 'shop',
            owner: 'alice',
            score: 12,
        },
    ]

    it('pickLineageJumpTarget prefers exact name then single downstream', () => {
        assert.equal(pickLineageJumpTarget([]), null)
        assert.equal(
            pickLineageJumpTarget([
                {modelName: 'orders_vm', fileName: 'orders_vm.sql', staleSidecar: false},
                {modelName: 'orders_agg', fileName: 'orders_agg.sql', staleSidecar: false},
            ], 'orders_agg')?.modelName,
            'orders_agg',
        )
        assert.equal(
            pickLineageJumpTarget([
                {modelName: 'only', fileName: 'only.sql', staleSidecar: false},
            ])?.modelName,
            'only',
        )
        assert.equal(
            pickLineageJumpTarget([
                {modelName: 'a', fileName: 'a.sql', staleSidecar: false},
                {modelName: 'b', fileName: 'b.sql', staleSidecar: false},
            ]),
            null,
        )
    })

    it('canJumpLineage only for table/view with scope', () => {
        assert.equal(canJumpLineage(tableHit), true)
        assert.equal(canJumpLineage({...tableHit, kind: 'metric'}), false)
        assert.equal(canJumpLineage({...tableHit, connectionId: ''}), false)
        assert.ok(discoveryHitRowKey(tableHit).includes('orders'))
    })

    it('buildDataCatalogFacetOptions counts kinds/connections/owners', () => {
        const options = buildDataCatalogFacetOptions(hits)
        assert.deepEqual(options.kinds.map((item) => item.value), ['table', 'view', 'metric'])
        assert.equal(options.connections.length, 2)
        assert.equal(options.owners.length, 1)
        assert.equal(options.owners[0].value, 'alice')
    })

    it('filterDiscoveryHitsByFacets applies AND across facet groups', () => {
        const filtered = filterDiscoveryHitsByFacets(hits, {
            kinds: ['metric'],
            connectionIds: ['c2'],
            owners: ['alice'],
        })
        assert.equal(filtered.length, 1)
        assert.equal(filtered[0].name, 'gmv')
        assert.equal(
            filterDiscoveryHitsByFacets(hits, {kinds: ['table'], connectionIds: ['c2'], owners: []}).length,
            0,
        )
    })

    it('toggleFacetValue adds and removes', () => {
        assert.deepEqual(toggleFacetValue(['table'], 'view'), ['table', 'view'])
        assert.deepEqual(toggleFacetValue(['table', 'view'], 'table'), ['view'])
    })
})
