import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {app} from 'electron'

const PREFERENCES_FILE = 'desktop-preferences.json'

export interface DesktopPreferences {
    /** 当前工作区根目录；空则使用默认工作区路径 */
    configDir?: string
    /** 最近使用过的工作区（绝对路径，最新在前） */
    recentWorkspaces?: string[]
}

function preferencesPath(): string {
    return join(app.getPath('userData'), PREFERENCES_FILE)
}

export function readDesktopPreferences(): DesktopPreferences {
    const path = preferencesPath()
    if (!existsSync(path)) return {}
    try {
        const raw = JSON.parse(readFileSync(path, 'utf8')) as DesktopPreferences
        return typeof raw === 'object' && raw ? raw : {}
    } catch {
        return {}
    }
}

export function writeDesktopPreferences(patch: DesktopPreferences): DesktopPreferences {
    const next = {...readDesktopPreferences(), ...patch}
    if (!next.configDir?.trim()) {
        delete next.configDir
    }
    const path = preferencesPath()
    mkdirSync(app.getPath('userData'), {recursive: true})
    writeFileSync(path, JSON.stringify(next, null, 2), 'utf8')
    return next
}
