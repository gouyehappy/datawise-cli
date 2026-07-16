import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
    buildConnectionDisplayHealthMap,
    mergePooledConnectionSync,
    resolveConnectionDisplayHealth,
    resolveConnectionLinkState,
    usesJdbcConnectionPool,
} from '../../features/explorer/services/explorer-connection-state.service.ts'

describe('explorer connection state', () => {
    it('display health only for pooled connections', () => {
        const pooled = new Set(['a', 'b'])
        const reachability = {a: 'ok' as const, b: 'error' as const, c: 'ok' as const}
        assert.equal(resolveConnectionDisplayHealth('a', pooled, reachability), 'ok')
        assert.equal(resolveConnectionDisplayHealth('b', pooled, reachability), 'error')
        assert.equal(resolveConnectionDisplayHealth('c', pooled, reachability), undefined)
        assert.deepEqual(buildConnectionDisplayHealthMap(pooled, reachability), {
            a: 'ok',
            b: 'error',
        })
    })

    it('link state uses pooled set for connected vs disconnected', () => {
        const pooled = new Set(['warm'])
        const loading = new Set<string>()
        assert.equal(
            resolveConnectionLinkState('warm', pooled, {warm: 'ok'}, loading),
            'connected',
        )
        assert.equal(
            resolveConnectionLinkState('cold', pooled, {cold: 'ok'}, loading),
            'disconnected',
        )
        assert.equal(
            resolveConnectionLinkState('cold', pooled, {cold: 'error'}, loading),
            'error',
        )
    })

    it('classifies non-jdbc datasources that never appear in server pool lists', () => {
        assert.equal(usesJdbcConnectionPool('mysql'), true)
        assert.equal(usesJdbcConnectionPool('redis'), false)
        assert.equal(usesJdbcConnectionPool('ssh'), false)
        assert.equal(usesJdbcConnectionPool('kafka'), false)
    })

    it('pool sync keeps ui-connected non-jdbc greens and evicts dropped jdbc pools', () => {
        const dbTypes: Record<string, string> = {
            'jdbc-warm': 'mysql',
            'jdbc-gone': 'mysql',
            'redis-live': 'redis',
        }
        const health: Record<string, 'ok' | 'error'> = {
            'jdbc-warm': 'ok',
            'jdbc-gone': 'ok',
            'redis-live': 'ok',
        }
        const {nextPooledIds, evictedIds} = mergePooledConnectionSync({
            serverPooledIds: ['jdbc-warm'],
            previousPooledIds: new Set(['jdbc-warm', 'jdbc-gone', 'redis-live']),
            resolveDbType: (id) => dbTypes[id],
            isUiConnected: (id) => health[id] === 'ok',
        })
        assert.deepEqual([...nextPooledIds].sort(), ['jdbc-warm', 'redis-live'])
        assert.deepEqual(evictedIds, ['jdbc-gone'])
    })
})
