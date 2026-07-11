import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
    buildConnectionDisplayHealthMap,
    resolveConnectionDisplayHealth,
    resolveConnectionLinkState,
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
})
