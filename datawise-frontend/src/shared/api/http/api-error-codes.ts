/** 后端稳定错误码 → i18n key（与 GlobalExceptionHandler / UserPermissionPolicy 对齐）。 */
export const STABLE_API_ERROR_I18N: Record<string, string> = {
    PERMISSION_DENIED: 'auth.permissionDenied',
    GUEST_NOT_ALLOWED: 'auth.guestNotAllowed',
    ADMIN_REQUIRED: 'auth.adminRequired',
}

export function stableApiErrorI18nKey(code: string | undefined | null): string | null {
    if (!code?.trim()) return null
    return STABLE_API_ERROR_I18N[code.trim()] ?? null
}
