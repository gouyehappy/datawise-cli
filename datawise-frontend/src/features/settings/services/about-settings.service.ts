import {configApi} from '@/api'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {
    canPersistLocalResource,
    canReadResource,
    canSyncServerResource,
    resolveResourceStorageKey,
} from '@/features/auth/services/user-resource-policy'

export const APP_VERSION = '1.0.0'

export const UPDATE_STORAGE_KEY = 'datawise-update-prefs'

export interface UpdatePreferences {
    notifyOnUpdate: boolean
    autoDownload: boolean
}

export const DEFAULT_UPDATE_PREFERENCES: UpdatePreferences = {
    notifyOnUpdate: true,
    autoDownload: true,
}

export interface UpdateCheckResult {
    currentVersion: string
    latestVersion: string
    hasUpdate: boolean
}

/** 检查更新：优先使用 Electron updater IPC，否则回退为演示结果 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
    const updater = globalThis.window?.datawise?.updater?.checkForUpdates
    if (updater) {
        return updater()
    }
    await delay(800)
    return {
        currentVersion: APP_VERSION,
        latestVersion: APP_VERSION,
        hasUpdate: false,
    }
}

function resolveUpdateStorageKey(): string {
    return resolveResourceStorageKey(UserResource.UpdatePreferences, UPDATE_STORAGE_KEY)
        ?? UPDATE_STORAGE_KEY
}

export function readStoredUpdatePreferences(): UpdatePreferences {
    if (!canReadResource(UserResource.UpdatePreferences)) {
        return {...DEFAULT_UPDATE_PREFERENCES}
    }
    try {
        const raw = localStorage.getItem(resolveUpdateStorageKey())
        if (!raw) return {...DEFAULT_UPDATE_PREFERENCES}
        const parsed = JSON.parse(raw) as Partial<UpdatePreferences>
        return {
            notifyOnUpdate: parsed.notifyOnUpdate ?? DEFAULT_UPDATE_PREFERENCES.notifyOnUpdate,
            autoDownload: parsed.autoDownload ?? DEFAULT_UPDATE_PREFERENCES.autoDownload,
        }
    } catch {
        return {...DEFAULT_UPDATE_PREFERENCES}
    }
}

export function persistUpdatePreferences(prefs: UpdatePreferences) {
    if (!canPersistLocalResource(UserResource.UpdatePreferences)) return
    localStorage.setItem(resolveUpdateStorageKey(), JSON.stringify(prefs))
    if (!canSyncServerResource(UserResource.UpdatePreferences)) return
    void configApi.saveUpdaterPreferences(prefs).catch((error) => {
        console.warn('[config] failed to persist updater.xml', error)
    })
}

export async function syncUpdatePreferencesFromServer(): Promise<UpdatePreferences> {
    try {
        const remote = await configApi.fetchUpdaterPreferences()
        if (canPersistLocalResource(UserResource.UpdatePreferences)) {
            localStorage.setItem(resolveUpdateStorageKey(), JSON.stringify(remote))
        }
        return remote
    } catch {
        return readStoredUpdatePreferences()
    }
}

function delay(ms: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms)
    })
}
