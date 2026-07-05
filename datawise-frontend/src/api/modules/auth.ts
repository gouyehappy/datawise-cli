import {api} from '@/shared/api'

export const authApi = {
    login: (userName: string, userPassword: string) => api.auth.login(userName, userPassword),
    loginAsGuest: () => api.auth.loginAsGuest(),
    signOut: () => api.auth.signOut(),
    changePassword: (currentPassword: string, newPassword: string) =>
        api.auth.changePassword(currentPassword, newPassword),
    getCurrentSession: (options?: import('@/shared/api/http/request').HttpRequestOptions) =>
        api.auth.getCurrentSession(options),
    getSessionPolicy: () => api.auth.getSessionPolicy(),
    updateSessionPolicy: (policy: import('@/shared/api/types').AuthSessionPolicy) =>
        api.auth.updateSessionPolicy(policy),
    resolveUserProfile: (userName: string, isGuest: boolean) =>
        api.auth.resolveUserProfile(userName, isGuest),
}
