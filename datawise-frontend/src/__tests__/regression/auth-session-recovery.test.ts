import {describe, it, beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {ApiError} from '../../shared/api/http/request.ts'
import {
    isApiSessionBlocked,
    markApiSessionBlockedForTest,
    maybeRejectBlockedRequest,
    resetUnauthorizedRecoveryState,
} from '../../shared/api/http/session-guard.ts'

describe('auth session recovery guard', () => {
    beforeEach(() => {
        resetUnauthorizedRecoveryState()
    })

    it('blocks subsequent API calls after session is marked invalid', () => {
        markApiSessionBlockedForTest()
        assert.equal(isApiSessionBlocked(), true)
        assert.throws(
            () => maybeRejectBlockedRequest(),
            (error: unknown) => error instanceof ApiError && error.message === 'UNAUTHORIZED',
        )
    })

    it('allows authBypass requests while session is blocked', () => {
        markApiSessionBlockedForTest()
        assert.doesNotThrow(() => maybeRejectBlockedRequest({authBypass: true}))
    })
})
