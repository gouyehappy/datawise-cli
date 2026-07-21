/** 后端稳定错误码 → i18n key（与 GlobalExceptionHandler / UserPermissionPolicy 对齐）。 */
export const STABLE_API_ERROR_I18N: Record<string, string> = {
    UNAUTHORIZED: 'auth.unauthorized',
    INTERNAL_ERROR: 'auth.errors.INTERNAL_ERROR',
    BAD_REQUEST: 'auth.errors.BAD_REQUEST',
    SQL_EXECUTION_FAILED: 'auth.errors.SQL_EXECUTION_FAILED',
    IO_ERROR: 'auth.errors.IO_ERROR',
    FORBIDDEN: 'auth.permissionDenied',
    PERMISSION_DENIED: 'auth.permissionDenied',
    SQL_PRODUCTION_APPROVAL_REQUIRED: 'auth.errors.SQL_PRODUCTION_APPROVAL_REQUIRED',
    GUEST_NOT_ALLOWED: 'auth.guestNotAllowed',
    ADMIN_REQUIRED: 'auth.adminRequired',
    PLATFORM_ADMIN_REQUIRED: 'auth.platformAdminRequired',
    TENANCY_MULTI_REQUIRED: 'auth.errors.TENANCY_MULTI_REQUIRED',
    TENANT_ACCESS_DENIED: 'auth.errors.TENANT_ACCESS_DENIED',
    TENANT_NAME_REQUIRED: 'auth.errors.TENANT_NAME_REQUIRED',
    TENANT_SLUG_RESERVED: 'auth.errors.TENANT_SLUG_RESERVED',
    TENANT_SLUG_EXISTS: 'auth.errors.TENANT_SLUG_EXISTS',
    TENANT_SLUG_INVALID: 'auth.errors.TENANT_SLUG_INVALID',
    TENANT_ADMIN_NOT_FOUND: 'auth.errors.TENANT_ADMIN_NOT_FOUND',
    TENANT_ADMIN_GUEST_FORBIDDEN: 'auth.errors.TENANT_ADMIN_GUEST_FORBIDDEN',
    TENANT_STATUS_REQUIRED: 'auth.errors.TENANT_STATUS_REQUIRED',
    TENANT_STATUS_INVALID: 'auth.errors.TENANT_STATUS_INVALID',
    TENANT_DEFAULT_DELETE_FORBIDDEN: 'auth.errors.TENANT_DEFAULT_DELETE_FORBIDDEN',
    TENANT_REQUEST_REQUIRED: 'auth.errors.TENANT_REQUEST_REQUIRED',
    TENANT_GUEST_JOIN_FORBIDDEN: 'auth.errors.TENANT_GUEST_JOIN_FORBIDDEN',
    TENANT_NOT_FOUND: 'auth.errors.TENANT_NOT_FOUND',
    TENANT_MEMBERSHIP_NOT_FOUND: 'auth.errors.TENANT_MEMBERSHIP_NOT_FOUND',
    TENANT_LAST_ADMIN: 'auth.errors.TENANT_LAST_ADMIN',
    TENANT_SUSPENDED: 'auth.errors.TENANT_SUSPENDED',
    TENANT_DELETED: 'auth.errors.TENANT_DELETED',
    TENANT_USER_NOT_FOUND: 'auth.errors.TENANT_USER_NOT_FOUND',
    TENANT_USER_REQUIRED: 'auth.errors.TENANT_USER_REQUIRED',
    TENANT_ROLE_REQUIRED: 'auth.errors.TENANT_ROLE_REQUIRED',
    TENANT_ROLE_UNKNOWN: 'auth.errors.TENANT_ROLE_UNKNOWN',
    TENANT_CONNECTION_QUOTA_EXCEEDED: 'auth.errors.TENANT_CONNECTION_QUOTA_EXCEEDED',
    TENANT_AI_QUOTA_EXCEEDED: 'auth.errors.TENANT_AI_QUOTA_EXCEEDED',
    ROLE_KEY_INVALID: 'auth.errors.ROLE_KEY_INVALID',
    ROLE_KEY_EXISTS: 'auth.errors.ROLE_KEY_EXISTS',
    ROLE_SYSTEM_LOCKED: 'auth.errors.ROLE_SYSTEM_LOCKED',
    ROLE_IN_USE: 'auth.errors.ROLE_IN_USE',
    ROLE_NAME_REQUIRED: 'auth.errors.ROLE_NAME_REQUIRED',
    OIDC_TENANT_UNMAPPED: 'auth.errors.OIDC_TENANT_UNMAPPED',
    OIDC_TENANT_MEMBERSHIP_REQUIRED: 'auth.errors.OIDC_TENANT_MEMBERSHIP_REQUIRED',
    OIDC_ROLE_MISSING: 'auth.errors.OIDC_ROLE_MISSING',
    REGISTRATION_DISABLED: 'auth.registrationDisabled',
    USERNAME_TAKEN: 'auth.usernameTaken',
    PASSWORD_TOO_SHORT: 'auth.passwordTooShort',
    INVALID_CREDENTIALS: 'auth.invalidCredentials',
    LOCAL_LOGIN_DISABLED: 'auth.localLoginDisabled',
    GUEST_ROLES_UNSUPPORTED: 'auth.errors.GUEST_ROLES_UNSUPPORTED',
    ROLES_REQUIRED: 'auth.errors.ROLES_REQUIRED',
    INVALID_ROLE: 'auth.errors.INVALID_ROLE',
    CANNOT_MODIFY_ADMIN_PERMISSIONS: 'auth.errors.CANNOT_MODIFY_ADMIN',
    USER_NOT_FOUND: 'auth.errors.TENANT_USER_NOT_FOUND',
}

export function stableApiErrorI18nKey(code: string | undefined | null): string | null {
    if (!code?.trim()) return null
    const trimmed = code.trim()
    if (STABLE_API_ERROR_I18N[trimmed]) {
        return STABLE_API_ERROR_I18N[trimmed]
    }
    // 后端偶发 "unknown role: xxx"
    if (trimmed.startsWith('unknown role:')) {
        return STABLE_API_ERROR_I18N.TENANT_ROLE_UNKNOWN
    }
    return null
}
