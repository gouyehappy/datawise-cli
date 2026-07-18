import type {AuthApi, AuthSessionPolicy, AuthUserProfile, LoginResult, SessionInfo} from '@/shared/api/types'
import type {HttpRequestOptions} from '@/shared/api/http/request'
import {getJson, postForm, postJson, putJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

function resolveHttpUserProfile(userName: string, isGuest: boolean): AuthUserProfile {
    if (isGuest) {
        return {displayName: 'Guest', email: 'guest@datawise.local'}
    }
    return {displayName: userName, email: `${userName}@datawise.local`}
}

/** 对接 datawise-backend /login 与 /login/guest */
export function createHttpAuthApi(): AuthApi {
    return {
        login: async (userName, userPassword) => {
            const body = new URLSearchParams({userName, userPassword})
            return postForm<LoginResult>(API_PATHS.auth.login, body, {authBypass: true})
        },

        loginAsGuest: async () =>
            postForm<LoginResult>(API_PATHS.auth.loginGuest, new URLSearchParams(), {authBypass: true}),

        register: async (request) =>
            postJson<LoginResult>(API_PATHS.auth.register, request, {authBypass: true}),

        signOut: async () => {
            await postForm<void>(API_PATHS.auth.signOut, new URLSearchParams(), {authBypass: true})
        },

        getCurrentSession: async (options) =>
            getJson<SessionInfo>(API_PATHS.auth.session, undefined, options),

        switchTenant: async (tenantId) =>
            postJson<SessionInfo>(API_PATHS.auth.switchTenant, {tenantId}),

        getSessionPolicy: async () => getJson<AuthSessionPolicy>(API_PATHS.auth.sessionPolicy),

        updateSessionPolicy: async (policy) =>
            putJson<AuthSessionPolicy>(API_PATHS.auth.sessionPolicy, policy),

        changePassword: async (currentPassword, newPassword) => {
            await postJson<void>(API_PATHS.auth.changePassword, {currentPassword, newPassword})
        },

        getLoginOptions: async () =>
            getJson(API_PATHS.auth.loginOptions, undefined, {authBypass: true, silent: true}),

        getOidcConfig: async () => getJson(API_PATHS.auth.oidcConfig),

        updateOidcConfig: async (request) =>
            putJson(API_PATHS.auth.oidcConfig, request),

        resolveUserProfile: resolveHttpUserProfile,
    }
}
