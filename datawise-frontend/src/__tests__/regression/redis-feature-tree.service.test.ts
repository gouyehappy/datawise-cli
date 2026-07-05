import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {
    buildRedisConnectionFeatureChildren,
    ensureRedisConnectionFeatureChildren,
    parseRedisFeatureId,
} from '@/features/explorer/services/redis-feature-tree.service'

describe('redis-feature-tree.service', () => {
    it('builds virtual feature nodes under redis connection', () => {
        const children = buildRedisConnectionFeatureChildren('redis-1')
        assert.equal(children.length, 2)
        assert.equal(children[0].meta, 'keys')
        assert.equal(children[1].meta, 'command')
    })

    it('injects children once for redis connection', () => {
        const connection = {id: 'redis-1', label: 'local', type: 'connection' as const, dbType: 'redis' as const}
        ensureRedisConnectionFeatureChildren(connection)
        assert.equal(connection.children?.length, 2)
        const previous = connection.children
        ensureRedisConnectionFeatureChildren(connection)
        assert.equal(connection.children, previous)
    })

    it('parses feature id from node meta', () => {
        assert.equal(parseRedisFeatureId({type: 'redis-feature', meta: 'keys'}), 'keys')
        assert.equal(parseRedisFeatureId({type: 'redis-feature', meta: 'command'}), 'command')
        assert.equal(parseRedisFeatureId({type: 'connection', meta: 'keys'}), null)
    })
})
