import {settingsApi} from '@/api'
import {
    resolveDataDirectoryLayout,
    type ResolvedDataDirectoryLayout,
} from '@/shared/config/data-directory-layout'

export interface WorkspaceListEntry {
    path: string
    active: boolean
    isDefault: boolean
}

export interface ConfigDirSettings {
    configured: string | null
    resolved: string
    defaultPath: string
    canChange: boolean
    recentWorkspaces: WorkspaceListEntry[]
}

export interface DataDirectorySettings extends ConfigDirSettings {
    layout: ResolvedDataDirectoryLayout
}

const EMPTY_RECENT: WorkspaceListEntry[] = []

export async function loadConfigDirSettings(): Promise<ConfigDirSettings> {
    const full = await loadDataDirectorySettings()
    return {
        configured: full.configured,
        resolved: full.resolved,
        defaultPath: full.defaultPath,
        canChange: full.canChange,
        recentWorkspaces: full.recentWorkspaces,
    }
}

export async function loadDataDirectorySettings(): Promise<DataDirectorySettings> {
    const health = await settingsApi.pingHealth().catch(() => null)

    let settings: ConfigDirSettings
    if (window.datawise?.config) {
        settings = await window.datawise.config.getSettings()
    } else {
        settings = {
            configured: null,
            resolved: health?.result?.configDir ?? '',
            defaultPath: '',
            canChange: false,
            recentWorkspaces: EMPTY_RECENT,
        }
    }

    const root = settings.resolved || health?.result?.configDir || ''

    return {
        ...settings,
        layout: resolveDataDirectoryLayout(root),
    }
}

export async function pickConfigDirectory(): Promise<string | null> {
    return window.datawise?.config?.pickDirectory() ?? null
}

export async function applyConfigDirectoryAndRestart(configDir: string | null): Promise<boolean> {
    if (!window.datawise?.config) return false
    return window.datawise.config.applyAndRestart(configDir)
}

export async function switchWorkspaceAndRestart(resolvedPath: string | null): Promise<boolean> {
    if (!window.datawise?.config) return false
    return window.datawise.config.switchWorkspace(resolvedPath)
}

export type CreateWorkspaceResult =
    | {ok: true; path: string}
    | {ok: false; error: 'invalid' | 'exists'}

export async function prepareNewWorkspace(name: string): Promise<CreateWorkspaceResult | null> {
    if (!window.datawise?.config) return null
    return window.datawise.config.createWorkspace(name)
}

export async function removeRecentWorkspace(resolvedPath: string): Promise<WorkspaceListEntry[]> {
    if (!window.datawise?.config) return EMPTY_RECENT
    return window.datawise.config.removeRecentWorkspace(resolvedPath)
}

export async function resolveConfigDirectoryPath(configured: string): Promise<string> {
    if (window.datawise?.config) {
        return window.datawise.config.resolvePath(configured)
    }
    return configured.trim()
}

export function workspaceEntryLabel(
    entry: WorkspaceListEntry,
    defaultLabel: string,
): string {
    if (entry.isDefault) return defaultLabel
    const segments = entry.path.replace(/[/\\]+$/, '').split(/[/\\]/)
    const name = segments[segments.length - 1]
    return name || entry.path
}
