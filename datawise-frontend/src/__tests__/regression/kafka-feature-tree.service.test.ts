import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {
    buildKafkaConnectionFeatureChildren,
    ensureKafkaConnectionFeatureChildren,
    parseKafkaFeatureId,
} from '@/features/explorer/services/kafka-feature-tree.service'

describe('kafka-feature-tree.service', () => {
    it('builds virtual feature nodes under kafka connection', () => {
        const children = buildKafkaConnectionFeatureChildren('kafka-1')
        assert.equal(children.length, 2)
        assert.deepEqual(children[0], {
            id: 'kafka-1:kafka:feature:topics',
            label: 'topics',
            type: 'kafka-feature',
            dbType: 'kafka',
            meta: 'topics',
        })
        assert.equal(children[1].meta, 'consumer-groups')
    })

    it('injects children once for kafka connection', () => {
        const connection = {id: 'kafka-1', label: 'local', type: 'connection' as const, dbType: 'kafka' as const}
        ensureKafkaConnectionFeatureChildren(connection)
        assert.equal(connection.children?.length, 2)
        const previous = connection.children
        ensureKafkaConnectionFeatureChildren(connection)
        assert.equal(connection.children, previous)
    })

    it('parses feature id from node meta', () => {
        assert.equal(parseKafkaFeatureId({type: 'kafka-feature', meta: 'topics'}), 'topics')
        assert.equal(parseKafkaFeatureId({type: 'kafka-feature', meta: 'consumer-groups'}), 'consumer-groups')
        assert.equal(parseKafkaFeatureId({type: 'connection', meta: 'topics'}), null)
    })
})
