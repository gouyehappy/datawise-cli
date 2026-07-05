export const APP_CONFIG_KEY = 'dw-app-config'

const SCOPED_STORAGE_BASE_KEYS = [
    APP_CONFIG_KEY,
    'dw-cli-ai-chat',
    'dw-cli-ai-analysis-templates',
    'datawise-pinned-explorer-nodes',
    'dw-grid-view-state-v1',
    'dw-cli-editor-settings',
    'dw-cli-theme-prefs',
    'datawise.table-migration.history',
] as const

let activeStorageScope = 'guest'
let activeAppConfigStorageKey = `${APP_CONFIG_KEY}:${activeStorageScope}`

export function resolveAppConfigStorageKey(): string {
    return activeAppConfigStorageKey
}

/** 按当前登录用户解析 localStorage key（访客与注册用户隔离）。 */
export function resolveUserStorageKey(baseKey: string): string {
    return `${baseKey}:${activeStorageScope}`
}

function migrateLegacyScopedKey(baseKey: string, scope: string, legacyScopes: string[] = []): void {
    if (typeof localStorage === 'undefined') return
    const scopedKey = `${baseKey}:${scope}`
    if (localStorage.getItem(scopedKey)) return

    const legacy = localStorage.getItem(baseKey)
    if (legacy) {
        localStorage.setItem(scopedKey, legacy)
        return
    }

    for (const legacyScope of legacyScopes) {
        const legacyKey = `${baseKey}:${legacyScope}`
        const legacyValue = localStorage.getItem(legacyKey)
        if (legacyValue) {
            localStorage.setItem(scopedKey, legacyValue)
            return
        }
    }
}

export interface AppConfigStorageScopeOptions {
    userId?: number | null
    userName?: string
    isGuest: boolean
}

/** 切换登录用户时更新 localStorage 命名空间，避免读到上一用户的布局/偏好。 */
export function setAppConfigStorageScope(options: AppConfigStorageScopeOptions): void {
    const scope = options.isGuest
        ? 'guest'
        : `user:${options.userId ?? 'unknown'}`
    activeStorageScope = scope
    activeAppConfigStorageKey = `${APP_CONFIG_KEY}:${scope}`

    const legacyScopes = !options.isGuest && options.userName?.trim()
        ? [options.userName.trim()]
        : []

    if (typeof localStorage !== 'undefined') {
        for (const baseKey of SCOPED_STORAGE_BASE_KEYS) {
            migrateLegacyScopedKey(baseKey, scope, legacyScopes)
        }
    }
}
