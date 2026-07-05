import type {ConfigApi} from '@/shared/api/types'
import {readApiBaseUrl} from '@/shared/api/mode'
import {getJson, putJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'
import type {AppConfigFile} from '@/shared/config/app-config.types'
import type {SqlEditorShortcutsLayer} from '@datawise/sql-editor/types'
import type {UpdatePreferences} from '@/features/settings/services/about-settings.service'
import type {ConnectionsCatalog} from '@/shared/config/connections-catalog.types'

function buildUrl(path: string): string {
    const base = readApiBaseUrl()
    return base ? `${base}${path}` : path
}

function sessionHeaders(): Record<string, string> {
    if (typeof localStorage === 'undefined') return {}
    const sessionId = localStorage.getItem('dw-cli-session-id')
    return sessionId ? {'X-DW-Session-Id': sessionId} : {}
}

async function putXml(path: string, xml: string): Promise<void> {
    const response = await fetch(buildUrl(path), {
        method: 'PUT',
        headers: {
            ...sessionHeaders(),
            'Content-Type': 'application/xml',
        },
        body: xml,
        credentials: 'include',
    })
    if (!response.ok) {
        throw new Error(`Failed to upload XML config: ${response.status}`)
    }
    const payload = await response.json() as { code: number; msg: string }
    if (payload.code !== 0) {
        throw new Error(payload.msg || 'Failed to upload XML config')
    }
}

async function getXml(path: string): Promise<string> {
    const response = await fetch(buildUrl(path), {
        method: 'GET',
        headers: sessionHeaders(),
        credentials: 'include',
    })
    if (!response.ok) {
        throw new Error(`Failed to fetch XML config: ${response.status}`)
    }
    return response.text()
}

const CONFIG_READ_OPTIONS = {silent: true} as const
/** 后台 debounce 写入失败时不弹 Toast（如退出后访客拦截 GUEST_NOT_ALLOWED）。 */
const CONFIG_WRITE_OPTIONS = {silent: true} as const

export function createHttpConfigApi(): ConfigApi {
    return {
        fetchAppConfig: () => getJson<AppConfigFile | null>(API_PATHS.config.app, undefined, CONFIG_READ_OPTIONS),
        saveAppConfig: (config) => putJson<void>(API_PATHS.config.app, config, CONFIG_WRITE_OPTIONS),
        fetchAppConfigXml: () => getXml(API_PATHS.config.appXml),
        saveAppConfigXml: (xml) => putXml(API_PATHS.config.appXml, xml),
        fetchSqlSnippets: (layer) =>
            getJson<SqlEditorShortcutsLayer | null>(
                API_PATHS.config.sqlSnippets(layer),
                undefined,
                CONFIG_READ_OPTIONS,
            ),
        saveSqlSnippets: (layer, payload) =>
            putJson<void>(API_PATHS.config.sqlSnippets(layer), payload, CONFIG_WRITE_OPTIONS),
        fetchUpdaterPreferences: () =>
            getJson<UpdatePreferences>(API_PATHS.config.updater, undefined, CONFIG_READ_OPTIONS),
        saveUpdaterPreferences: (prefs) =>
            putJson<void>(API_PATHS.config.updater, prefs, CONFIG_WRITE_OPTIONS),
        fetchConnectionsCatalog: () =>
            getJson<ConnectionsCatalog>(API_PATHS.config.connections, undefined, CONFIG_READ_OPTIONS),
        saveConnectionsCatalog: (catalog) =>
            putJson<void>(API_PATHS.config.connections, catalog, CONFIG_WRITE_OPTIONS),
        fetchConnectionsXml: () => getXml(API_PATHS.config.connectionsXml),
        saveConnectionsXml: (xml) => putXml(API_PATHS.config.connectionsXml, xml),
    }
}
