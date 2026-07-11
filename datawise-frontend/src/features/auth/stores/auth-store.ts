import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import {authApi, type AuthUser} from '@/api'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useToastStore} from '@/features/layout/stores/toast-store'
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
import type {SessionInfo} from '@/shared/api/types'
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

    const isGuest = computed(() => user.value?.isGuest ?? true)

    function applyUserProfile(next: AuthUser) {
        user.value = next
        const layout = useLayoutStore()
        layout.profileName = next.displayName
        layout.profileEmail = next.email
    }

    function buildUser(userName: string, isGuestUser: boolean, userId?: number | null): AuthUser {
        const profile = authApi.resolveUserProfile(userName, isGuestUser)
        return {
            userName,
            userId: isGuestUser ? null : userId ?? null,
            displayName: isGuestUser ? t('auth.guestDisplayName') : profile.displayName,
            email: profile.email,
            isGuest: isGuestUser,
        }
    }

    function applySessionInfo(session: SessionInfo) {
        persistAuthSession(session)
        sessionId.value = session.sessionId
        applyUserProfile(buildUser(session.userName, session.guest, session.userId))
    }

    function applyGuestSession(nextSessionId: string, userName = 'guest', expiresAtEpochMs?: number | null) {
        persistSession(nextSessionId, userName, true, expiresAtEpochMs, null)
        sessionId.value = nextSessionId
        applyUserProfile(buildUser(userName, true, null))
    }

    function restoreSession() {
        if (!isLoggedIn()) return false
        const storedSessionId = localStorage.getItem(SESSION_KEY)
        if (!isBackendSessionId(storedSessionId)) {
            clearSession()
            return false
        }
        const userName = localStorage.getItem(USERNAME_KEY) ?? 'guest'
        const guest = readGuestFlag()
        sessionId.value = storedSessionId
        applyUserProfile(buildUser(userName, guest, readUserId()))
        return true
    }

    function bootstrapGuestSession() {
        applyGuestSession(createLocalSessionId('guest'))
    }

    function bootstrap() {
        if (restoreSession()) return
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
            useToastStore().show(t('auth.sessionExpired'))
        }
    }

    async function bootstrapAsync(backendConnected = true) {
        const hadSession = restoreSession()
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
        applyUserProfile(buildUser(result.userName ?? userName, false, result.userId))
        await resetUserScopedState()
    }

    async function loginAsGuest() {
        const result = await authApi.loginAsGuest()
        if (!result.sessionId) {
            throw new Error(t('auth.guestFailed'))
        }
        applyGuestSession(result.sessionId, result.userName ?? 'guest', result.expiresAtEpochMs)
        await resetUserScopedState()
    }

    async function handleUnauthorizedAccess() {
        cancelDeferredConfigServerWrites()
        clearSession()
        sessionId.value = null
        user.value = null
        openLoginDialog()
        useToastStore().show(t('auth.sessionExpired'))
        try {
            await loginAsGuest()
        } catch {
            bootstrapGuestSession()
        }
    }

    async function signOut() {
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
        useToastStore().show(t('auth.backToGuest'))
    }

    return {
        sessionId,
        user,
        isGuest,
        loginDialogOpen,
        restoreSession,
        bootstrap,
        bootstrapAsync,
        applySessionInfo,
        openLoginDialog,
        closeLoginDialog,
        login,
        loginAsGuest,
        handleUnauthorizedAccess,
        signOut,
    }
})
