import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
    resolveApiErrorMessage,
    resolveDisplayApiErrorMessage,
} from '@/shared/api/http/api-error-message'
import {ApiError} from '@/shared/api/http/request'

describe('api-error-message', () => {
    const translate = (key: string) => `tr:${key}`

    it('resolves raw error message', () => {
        assert.equal(resolveApiErrorMessage(new Error('NETWORK_FAIL')), 'NETWORK_FAIL')
    })

    it('maps stable permission codes to i18n keys', () => {
        assert.equal(
            resolveDisplayApiErrorMessage(new Error('PERMISSION_DENIED'), translate),
            'tr:auth.permissionDenied',
        )
        assert.equal(
            resolveDisplayApiErrorMessage(new Error('GUEST_NOT_ALLOWED'), translate),
            'tr:auth.guestNotAllowed',
        )
        assert.equal(
            resolveDisplayApiErrorMessage(new Error('ADMIN_REQUIRED'), translate),
            'tr:auth.adminRequired',
        )
        assert.equal(
            resolveDisplayApiErrorMessage(new Error('TENANT_LAST_ADMIN'), translate),
            'tr:auth.errors.TENANT_LAST_ADMIN',
        )
        assert.equal(
            resolveDisplayApiErrorMessage(new Error('ROLE_KEY_INVALID'), translate),
            'tr:auth.errors.ROLE_KEY_INVALID',
        )
    })

    it('falls back to raw message for unknown codes', () => {
        assert.equal(
            resolveDisplayApiErrorMessage(new Error('CONNECTION_ACCESS_DENIED'), translate),
            'CONNECTION_ACCESS_DENIED',
        )
    })

    it('maps legacy unknown-role prefix', () => {
        assert.equal(
            resolveDisplayApiErrorMessage(new Error('unknown role: ops'), translate),
            'tr:auth.errors.TENANT_ROLE_UNKNOWN',
        )
    })

    it('uses ApiError message body', () => {
        assert.equal(
            resolveDisplayApiErrorMessage(new ApiError('PERMISSION_DENIED', 403), translate),
            'tr:auth.permissionDenied',
        )
    })
})
