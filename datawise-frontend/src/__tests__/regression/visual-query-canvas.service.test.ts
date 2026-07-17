import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {layoutVisualQueryCanvas} from '@/features/workspace/services/visual-query-canvas.service'

describe('visual-query-canvas.service', () => {
    it('layouts from table and joins left to right', () => {
        const layout = layoutVisualQueryCanvas({
            fromTable: 'orders',
            fromAlias: 'o',
            joins: [
                {table: 'users', alias: 'u', type: 'LEFT'},
                {table: 'items', alias: 'i', type: 'INNER'},
            ],
        })
        assert.equal(layout.nodes.length, 3)
        assert.equal(layout.edges.length, 2)
        assert.equal(layout.nodes[0].kind, 'from')
        assert.ok(layout.nodes[1].x > layout.nodes[0].x)
        assert.ok(layout.nodes[2].x > layout.nodes[1].x)
        assert.equal(layout.edges[0].label, 'LEFT')
        assert.equal(layout.edges[1].label, 'INNER')
    })

    it('returns empty layout without from table', () => {
        const layout = layoutVisualQueryCanvas({
            fromTable: '',
            fromAlias: '',
            joins: [{table: 'users', alias: 'u', type: 'LEFT'}],
        })
        assert.equal(layout.nodes.length, 0)
        assert.equal(layout.edges.length, 0)
    })
})
