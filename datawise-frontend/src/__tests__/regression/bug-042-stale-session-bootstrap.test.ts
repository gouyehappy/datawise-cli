import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {ApiError} from '../../shared/api/http/request.ts'
import {
    isUnauthorizedApiError,
    shouldRecoverStaleSession,
    shouldValidateBackendSession,
} from '../../features/auth/services/auth-session.service.ts'

describe('auth session bootstrap helpers', () => {
    it('shouldValidateBackendSession requires stored session and connected backend', () => {
        assert.equal(shouldValidateBackendSession(true, true), true)
        assert.equal(shouldValidateBackendSession(true, false), false)
        assert.equal(shouldValidateBackendSession(false, true), false)
    })

    it('isUnauthorizedApiError detects backend UNAUTHORIZED payload', () => {
        assert.equal(isUnauthorizedApiError(new ApiError('UNAUTHORIZED')), true)
        assert.equal(isUnauthorizedApiError(new ApiError('HTTP 401')), false)
        assert.equal(isUnauthorizedApiError(new Error('UNAUTHORIZED')), false)
    })

    it('shouldRecoverStaleSession only reacts to UNAUTHORIZED ApiError', () => {
        assert.equal(shouldRecoverStaleSession(new ApiError('UNAUTHORIZED')), true)
        assert.equal(shouldRecoverStaleSession(new ApiError('HTTP API request failed.')), false)
    })
})
