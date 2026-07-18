import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
    canJumpLineage,
    discoveryHitRowKey,
    pickLineageJumpTarget,
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
})
