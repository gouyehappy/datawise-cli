import {describe, it, beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {ApiError} from '../../shared/api/http/request.ts'
import {
    isApiSessionBlocked,
    isQuietAuthFailure,
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

    it('treats blocked session and UNAUTHORIZED as quiet auth failures', () => {
        assert.equal(isQuietAuthFailure(new ApiError('UNAUTHORIZED')), true)
        assert.equal(isQuietAuthFailure(new ApiError('boom')), false)
        markApiSessionBlockedForTest()
        assert.equal(isQuietAuthFailure(new ApiError('HTTP API request failed')), true)
    })
})
