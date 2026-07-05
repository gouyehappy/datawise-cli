import {existsSync, mkdirSync} from 'node:fs'
import {join, normalize} from 'node:path'
import {app} from 'electron'
import {readDesktopPreferences, writeDesktopPreferences} from './desktop-preferences'

export const MAX_RECENT_WORKSPACES = 8

export interface WorkspaceListEntry {
    path: string
    active: boolean
    isDefault: boolean
}

export type CreateWorkspaceResult =
    | {ok: true; path: string}
    | {ok: false; error: 'invalid' | 'exists'}

export function sanitizeWorkspaceFolderName(name: string): string | null {
    const trimmed = name.trim()
    if (!trimmed) return null
    if (/[<>:"|?*\x00/\\]/.test(trimmed)) return null
    if (trimmed === '.' || trimmed === '..') return null
    return trimmed
}

export function workspaceDirectoryHasConfig(dir: string): boolean {
    return existsSync(join(dir, 'users.json'))
        || existsSync(join(dir, 'connections.xml'))
        || existsSync(join(dir, 'sessions.json'))
}

export function resolveNewWorkspaceParent(): string {
    const parent = join(app.getPath('documents'), 'DataWise', 'workspaces')
    mkdirSync(parent, {recursive: true})
    return parent
}

export function prepareNewWorkspaceDirectory(name: string): CreateWorkspaceResult {
    const safe = sanitizeWorkspaceFolderName(name)
    if (!safe) return {ok: false, error: 'invalid'}

    const target = join(resolveNewWorkspaceParent(), safe)
    if (existsSync(target) && workspaceDirectoryHasConfig(target)) {
        return {ok: false, error: 'exists'}
    }

    mkdirSync(target, {recursive: true})
    return {ok: true, path: normalize(target)}
}

export function normalizeWorkspacePath(path: string): string {
    const trimmed = path.trim()
    if (!trimmed) return ''
    return normalize(trimmed)
}

export function touchRecentWorkspace(resolvedPath: string): string[] {
    const key = normalizeWorkspacePath(resolvedPath)
    if (!key) return readDesktopPreferences().recentWorkspaces ?? []

    const prev = readDesktopPreferences().recentWorkspaces ?? []
    const next = [key, ...prev.filter((item) => normalizeWorkspacePath(item) !== key)]
        .slice(0, MAX_RECENT_WORKSPACES)
    writeDesktopPreferences({recentWorkspaces: next})
    return next
}

export function removeRecentWorkspace(resolvedPath: string): string[] {
    const key = normalizeWorkspacePath(resolvedPath)
    const prev = readDesktopPreferences().recentWorkspaces ?? []
    const next = prev.filter((item) => normalizeWorkspacePath(item) !== key)
    writeDesktopPreferences({recentWorkspaces: next})
    return next
}

export function buildWorkspaceList(activePath: string, defaultPath: string): WorkspaceListEntry[] {
    const activeNorm = normalizeWorkspacePath(activePath)
    const defaultNorm = normalizeWorkspacePath(defaultPath)
    const recent = readDesktopPreferences().recentWorkspaces ?? []

    const ordered: string[] = []
    const seen = new Set<string>()

    const push = (path: string) => {
        const normalized = normalizeWorkspacePath(path)
        if (!normalized || seen.has(normalized)) return
        seen.add(normalized)
        ordered.push(normalized)
    }

    push(activePath)
    for (const item of recent) push(item)
    push(defaultPath)

    const withoutActive = ordered.filter((path) => path !== activeNorm)
    const finalPaths = activeNorm ? [activeNorm, ...withoutActive] : withoutActive

    return finalPaths.map((path) => ({
        path,
        active: path === activeNorm,
        isDefault: path === defaultNorm,
    }))
}
