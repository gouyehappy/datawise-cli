import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
    canBeginTransaction,
    canCommitOrRollback,
    isManualTransactionMode,
    resolveTransactionScopeKey,
} from '@/features/workspace/services/transaction-mode.service'

describe('transaction mode service', () => {
    it('detects manual transaction mode', () => {
        assert.equal(isManualTransactionMode({autocommit: true, pending: false}), false)
        assert.equal(isManualTransactionMode({autocommit: false, pending: false}), true)
    })

    it('allows commit/rollback only when pending in manual mode', () => {
        assert.equal(canCommitOrRollback({autocommit: false, pending: true}), true)
        assert.equal(canCommitOrRollback({autocommit: false, pending: false}), false)
        assert.equal(canCommitOrRollback({autocommit: true, pending: true}), false)
    })

    it('allows begin only with connection and autocommit on', () => {
        assert.equal(canBeginTransaction({autocommit: true, pending: false}, 'c1'), true)
        assert.equal(canBeginTransaction({autocommit: false, pending: false}, 'c1'), false)
        assert.equal(canBeginTransaction({autocommit: true, pending: false}), false)
    })

    it('builds scope keys for connection/database changes', () => {
        assert.equal(resolveTransactionScopeKey('c1', 'db_a'), 'c1:db_a')
        assert.equal(resolveTransactionScopeKey('c1', 'db_b'), 'c1:db_b')
    })
})
