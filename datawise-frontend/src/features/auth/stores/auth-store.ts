import {defineStore} from 'pinia'
import {computed, nextTick, ref} from 'vue'
import {authApi, type AuthUser} from '@/api'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useAppToast} from '@/features/layout/composables/useAppToast'
import {
    clearSession,
    isLoggedIn,
    isLocalSessionExpired,
    persistSession,
    readGuestFlag,
    readUserId,
    SESSION_KEY,
    USERNAME_KEY,
} from '@/shared/auth/session'
import {
    shouldRecoverStaleSession,
    shouldValidateBackendSession,
} from '@/features/auth/services/auth-session.service'
import {
    persistAuthSession,
    persistLoginResult,
} from '@/features/auth/services/auth-session-persist.service'
import {resetUserScopedState} from '@/features/auth/services/user-session-reset.service'
import {cancelDeferredConfigServerWrites} from '@/shared/config/app-config.service'
import type {SessionInfo, LoginResult, TenantSummary} from '@/shared/api/types'
import {
    setActiveFeaturePermissions,
    createPreset,
    normalizeFeaturePermissionMap,
} from '@/features/auth/services/feature-permission.service'
import {FeaturePermission} from '@/features/auth/types/feature-permission.types'
import {t} from '@/i18n'

function createLocalSessionId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** 后端 SessionStore 签发的会话以 session- 开头；本地离线占位会话不是有效凭证。 */
function isBackendSessionId(sessionId: string | null | undefined): boolean {
    return Boolean(sessionId?.startsWith('session-'))
}

export const useAuthStore = defineStore('auth', () => {
    const sessionId = ref<string | null>(null)
    const user = ref<AuthUser | null>(null)
    const loginDialogOpen = ref(false)
    const isAdmin = ref(false)
    const tenantId = ref<string | null>(null)
    const tenantName = ref<string | null>(null)
    const tenancyMode = ref<'single' | 'multi'>('single')
    const platformAdmin = ref(false)
    const tenants = ref<TenantSummary[]>([])

    const isGuest = computed(() => user.value?.isGuest ?? true)
    const canSwitchTenant = computed(
        () => tenancyMode.value === 'multi' && !isGuest.value && tenants.value.length > 1,
    )

    function applyPermissionsFromSession(
        session: {
            admin?: boolean
            featurePermissions?: SessionInfo['featurePermissions']
            guest?: boolean
        },
    ) {
        isAdmin.value = session.admin === true
        if (session.admin) {
            setActiveFeaturePermissions(createPreset('full'))
        } else if (session.guest === true) {
            const permissions = session.featurePermissions && Object.keys(session.featurePermissions).length > 0
                ? normalizeFeaturePermissionMap(session.featurePermissions)
                : createPreset('workbench')
            permissions[FeaturePermission.NavDatabase] = true
            setActiveFeaturePermissions(permissions)
        } else if (session.featurePermissions && Object.keys(session.featurePermissions).length > 0) {
            setActiveFeaturePermissions(normalizeFeaturePermissionMap(session.featurePermissions))
        } else {
            setActiveFeaturePermissions(createPreset('full'))
        }
        void nextTick(() => useLayoutStore().ensureAccessibleModule())
    }

    function applyUserProfile(next: AuthUser) {
        user.value = next
        const layout = useLayoutStore()
        layout.profileName = next.displayName
        layout.profileEmail = next.email
    }

    function buildUser(
        userName: string,
        isGuestUser: boolean,
        userId?: number | null,
        admin = false,
    ): AuthUser {
        const profile = authApi.resolveUserProfile(userName, isGuestUser)
        return {
            userName,
            userId: userId ?? null,
            displayName: isGuestUser ? t('auth.guestDisplayName') : profile.displayName,
            email: profile.email,
            isGuest: isGuestUser,
            isAdmin: admin,
        }
    }

    function applyTenancyFromSession(session: SessionInfo | LoginResult) {
        tenantId.value = session.tenantId ?? null
        tenantName.value = session.tenantName ?? null
        tenancyMode.value = session.tenancyMode === 'multi' ? 'multi' : 'single'
        platformAdmin.value = session.platformAdmin === true
        tenants.value = Array.isArray(session.tenants) ? [...session.tenants] : []
    }

    function applySessionInfo(session: SessionInfo) {
        persistAuthSession(session)
        sessionId.value = session.sessionId
        applyPermissionsFromSession(session)
        applyTenancyFromSession(session)
        applyUserProfile(buildUser(session.userName, session.guest, session.userId, session.admin === true))
    }

    function applyGuestSession(
        nextSessionId: string,
        userName = 'guest',
        expiresAtEpochMs?: number | null,
        userId?: number | null,
        featurePermissions?: SessionInfo['featurePermissions'],
        admin = false,
    ) {
        persistSession(nextSessionId, userName, true, expiresAtEpochMs, userId ?? null)
        sessionId.value = nextSessionId
        applyPermissionsFromSession({guest: true, admin, featurePermissions})
        applyUserProfile(buildUser(userName, true, userId, admin))
    }

    function restoreSession(applyFallbackPermissions = false) {
        if (!isLoggedIn()) return false
        const storedSessionId = localStorage.getItem(SESSION_KEY)
        if (!isBackendSessionId(storedSessionId)) {
            clearSession()
            return false
        }
        const userName = localStorage.getItem(USERNAME_KEY) ?? 'guest'
        const guest = readGuestFlag()
        sessionId.value = storedSessionId
        if (applyFallbackPermissions) {
            applyPermissionsFromSession({guest, admin: false})
        }
        applyUserProfile(buildUser(userName, guest, readUserId(), false))
        return true
    }

    function bootstrapGuestSession() {
        applyGuestSession(createLocalSessionId('guest'))
    }

    function bootstrap() {
        if (restoreSession(true)) return
        bootstrapGuestSession()
    }

    async function recoverFromStaleSession(wasGuest: boolean) {
        cancelDeferredConfigServerWrites()
        clearSession()
        sessionId.value = null
        user.value = null
        try {
            await loginAsGuest()
        } catch {
            bootstrapGuestSession()
        }
        if (!wasGuest) {
            openLoginDialog()
            useAppToast().show(t('auth.sessionExpired'))
        }
    }

    async function bootstrapAsync(backendConnected = true) {
        const hadSession = restoreSession(false)
        const guest = readGuestFlag()

        if (!hadSession) {
            try {
                await loginAsGuest()
            } catch {
                bootstrapGuestSession()
            }
            return
        }

        if (!shouldValidateBackendSession(hadSession, backendConnected)) {
            if (isLocalSessionExpired()) {
                await recoverFromStaleSession(guest)
            } else {
                applyPermissionsFromSession({guest, admin: false})
            }
            return
        }

        try {
            const session = await authApi.getCurrentSession({silent: true})
            applySessionInfo(session)
            return
        } catch (error) {
            if (!shouldRecoverStaleSession(error)) {
                return
            }
        }

        await recoverFromStaleSession(guest)
    }

    function openLoginDialog() {
        loginDialogOpen.value = true
    }

    function closeLoginDialog() {
        loginDialogOpen.value = false
    }

    async function login(userName: string, userPassword: string) {
        const result = await authApi.login(userName, userPassword)
        if (!result.sessionId) {
            throw new Error(t('auth.failed'))
        }
        persistLoginResult(result, result.userName ?? userName, false)
        sessionId.value = result.sessionId
        applyPermissionsFromSession({
            guest: false,
            admin: result.admin === true,
            featurePermissions: result.featurePermissions,
        })
        applyTenancyFromSession(result)
        applyUserProfile(buildUser(result.userName ?? userName, false, result.userId, result.admin === true))
        await resetUserScopedState()
    }

    async function register(payload: {
        userName: string
        password: string
        email?: string
        displayName?: string
        tenantName?: string
        tenantSlug?: string
        createTenant?: boolean
    }) {
        const result = await authApi.register(payload)
        if (!result.sessionId) {
            throw new Error(t('auth.failed'))
        }
        persistLoginResult(result, result.userName ?? payload.userName, false)
        sessionId.value = result.sessionId
        applyPermissionsFromSession({
            guest: false,
            admin: result.admin === true,
            featurePermissions: result.featurePermissions,
        })
        applyTenancyFromSession(result)
        applyUserProfile(buildUser(
            result.userName ?? payload.userName,
            false,
            result.userId,
            result.admin === true,
        ))
        await resetUserScopedState()
    }

    /** Complete OIDC redirect: persist session id then refresh profile from backend. */
    async function completeOidcLogin(oidcSessionId: string, fallbackUserName?: string) {
        persistSession(oidcSessionId, fallbackUserName || 'oidc-user', false, null, null)
        sessionId.value = oidcSessionId
        const session = await authApi.getCurrentSession({authBypass: true})
        applySessionInfo(session)
        await resetUserScopedState()
    }

    async function loginAsGuest() {
        const result = await authApi.loginAsGuest()
        if (!result.sessionId) {
            throw new Error(t('auth.guestFailed'))
        }
        applyGuestSession(
            result.sessionId,
            result.userName ?? 'guest',
            result.expiresAtEpochMs,
            result.userId,
            result.featurePermissions,
            result.admin === true,
        )
        await resetUserScopedState()
    }

    /** 从服务端重新拉取当前会话权限（管理员改权限后立即生效）。 */
    async function refreshSessionPermissions() {
        if (!sessionId.value || !isBackendSessionId(sessionId.value)) return
        try {
            const session = await authApi.getCurrentSession({silent: true})
            applySessionInfo(session)
        } catch {
            // 静默失败：保留现有权限
        }
    }

    async function handleUnauthorizedAccess() {
        cancelDeferredConfigServerWrites()
        clearSession()
        sessionId.value = null
        user.value = null
        openLoginDialog()
        useAppToast().show(t('auth.sessionExpired'))
        try {
            await loginAsGuest()
        } catch {
            bootstrapGuestSession()
        }
    }

    async function switchTenant(nextTenantId: string) {
        if (!nextTenantId || nextTenantId === tenantId.value) {
            return
        }
        const session = await authApi.switchTenant(nextTenantId)
        applySessionInfo(session)
        await resetUserScopedState()
        useAppToast().show(t('auth.tenantSwitched', {name: session.tenantName || nextTenantId}))
    }

    async function signOut(options?: {silent?: boolean}) {
        cancelDeferredConfigServerWrites()
        try {
            await authApi.signOut()
        } catch {
            // 后端不可达时仍清理本地会话
        }
        clearSession()
        try {
            await loginAsGuest()
        } catch {
            bootstrapGuestSession()
        }
        await resetUserScopedState()
        if (!options?.silent) {
            useAppToast().show(t('auth.backToGuest'))
        }
    }

    return {
        sessionId,
        user,
        isGuest,
        isAdmin,
        tenantId,
        tenantName,
        tenancyMode,
        platformAdmin,
        tenants,
        canSwitchTenant,
        loginDialogOpen,
        restoreSession,
        bootstrap,
        bootstrapAsync,
        applySessionInfo,
        openLoginDialog,
        closeLoginDialog,
        login,
        register,
        completeOidcLogin,
        loginAsGuest,
        refreshSessionPermissions,
        handleUnauthorizedAccess,
        switchTenant,
        signOut,
    }
})
