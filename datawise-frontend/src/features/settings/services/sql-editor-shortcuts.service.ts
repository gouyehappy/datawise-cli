import {
    SQL_EDITOR_SHORTCUTS_SHARED_STORAGE_KEY,
    createEmptySqlEditorShortcutsLayer,
    type SqlEditorShortcutsLayer,
} from '@/features/settings/constants/sql-editor-shortcuts-presets'
import {
    readPersonalSqlEditorLayer,
    writePersonalSqlEditorLayer,
} from '@datawise/sql-editor/settings/personal-storage'
import {normalizeSqlEditorShortcutsLayer} from '@datawise/sql-editor/config/snippets'
import {sqlEditorShortcutsLayerHasOverrides} from '@datawise/sql-editor/config/snippets/layer-overrides'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {
    canPersistLocalResource,
    canReadResource,
    canSyncServerResource,
    resolveResourceStorageKey,
} from '@/features/auth/services/user-resource-policy'
import {createHttpConfigApi} from '@/shared/api/http/config'

const configHttp = createHttpConfigApi()

export const SQL_EDITOR_SHORTCUTS_SHARED_FILENAME = 'datawise-sql-snippets.shared.xml'

let sharedServerTimer: ReturnType<typeof setTimeout> | null = null
let personalServerTimer: ReturnType<typeof setTimeout> | null = null

/** 取消尚未执行的 SQL snippets 服务端写入（与 app-config 同理，避免退出后误报 GUEST_NOT_ALLOWED）。 */
export function cancelPendingSqlSnippetServerPersists(): void {
    if (sharedServerTimer) {
        clearTimeout(sharedServerTimer)
        sharedServerTimer = null
    }
    if (personalServerTimer) {
        clearTimeout(personalServerTimer)
        personalServerTimer = null
    }
}

function resolveSharedStorageKey(): string {
    return resolveResourceStorageKey(UserResource.SqlSnippetsShared, SQL_EDITOR_SHORTCUTS_SHARED_STORAGE_KEY)
        ?? SQL_EDITOR_SHORTCUTS_SHARED_STORAGE_KEY
}

function readSharedLayer(): SqlEditorShortcutsLayer {
    if (!canReadResource(UserResource.SqlSnippetsShared)) {
        return createEmptySqlEditorShortcutsLayer()
    }
    try {
        const raw = localStorage.getItem(resolveSharedStorageKey())
        if (!raw) return createEmptySqlEditorShortcutsLayer()
        return normalizeSqlEditorShortcutsLayer(JSON.parse(raw) as SqlEditorShortcutsLayer)
    } catch {
        return createEmptySqlEditorShortcutsLayer()
    }
}

function persistSharedLayer(layer: SqlEditorShortcutsLayer) {
    if (!canPersistLocalResource(UserResource.SqlSnippetsShared)) return
    const normalized = normalizeSqlEditorShortcutsLayer(layer)
    localStorage.setItem(resolveSharedStorageKey(), JSON.stringify(normalized))
    if (sharedServerTimer) clearTimeout(sharedServerTimer)
    if (!canSyncServerResource(UserResource.SqlSnippetsShared)) return
    sharedServerTimer = setTimeout(() => {
        if (!canSyncServerResource(UserResource.SqlSnippetsShared)) return
        void configHttp.saveSqlSnippets('shared', normalized).catch((error) => {
            console.warn('[config] failed to persist sql-snippets.shared.xml', error)
        })
    }, 420)
}

export function readStoredSharedSqlEditorShortcuts(): SqlEditorShortcutsLayer {
    return readSharedLayer()
}

export function readStoredPersonalSqlEditorShortcuts(): SqlEditorShortcutsLayer {
    if (!canReadResource(UserResource.SqlSnippetsPersonal)) {
        return createEmptySqlEditorShortcutsLayer()
    }
    return readPersonalSqlEditorLayer()
}

export function persistSharedSqlEditorShortcuts(layer: SqlEditorShortcutsLayer) {
    persistSharedLayer(layer)
}

export function persistPersonalSqlEditorShortcuts(layer: SqlEditorShortcutsLayer) {
    if (!canPersistLocalResource(UserResource.SqlSnippetsPersonal)) return
    const normalized = normalizeSqlEditorShortcutsLayer(layer)
    writePersonalSqlEditorLayer(normalized)
    if (personalServerTimer) clearTimeout(personalServerTimer)
    if (!canSyncServerResource(UserResource.SqlSnippetsPersonal)) return
    personalServerTimer = setTimeout(() => {
        if (!canSyncServerResource(UserResource.SqlSnippetsPersonal)) return
        void configHttp.saveSqlSnippets('personal', normalized).catch((error) => {
            console.warn('[config] failed to persist sql-snippets.personal.xml', error)
        })
    }, 420)
}

export function createAppSqlEditorShortcutsPersistence() {
    return {
        readPersonal: readStoredPersonalSqlEditorShortcuts,
        writePersonal: persistPersonalSqlEditorShortcuts,
        readShared: readStoredSharedSqlEditorShortcuts,
        writeShared: persistSharedSqlEditorShortcuts,
    }
}

/**
 * 运行时权威层：专用 localStorage key（personal 由 sql-editor 包定义，shared 由宿主定义）。
 * dw-app-config 内嵌字段仅作导入/导出信封，不参与本地运行时读取。
 */
export function readCanonicalSqlEditorLayers(): {
    personal: SqlEditorShortcutsLayer
    shared: SqlEditorShortcutsLayer
} {
    return {
        personal: readStoredPersonalSqlEditorShortcuts(),
        shared: readStoredSharedSqlEditorShortcuts(),
    }
}

/**
 * 将 dw-app-config 内嵌的 sql-editor 层迁移到专用 key（仅当专用 key 尚无覆盖时，幂等）。
 */
export function hydrateSqlEditorStorageFromAppConfigBody(body: {
    sqlEditorShortcuts?: SqlEditorShortcutsLayer | null
    sqlEditorShortcutsShared?: SqlEditorShortcutsLayer | null
}): void {
    const {personal: personalInKeys, shared: sharedInKeys} = readCanonicalSqlEditorLayers()

    if (!sqlEditorShortcutsLayerHasOverrides(personalInKeys) && body.sqlEditorShortcuts) {
        const fromConfig = normalizeSqlEditorShortcutsLayer(body.sqlEditorShortcuts)
        if (sqlEditorShortcutsLayerHasOverrides(fromConfig)) {
            persistPersonalSqlEditorShortcuts(fromConfig)
        }
    }

    if (!sqlEditorShortcutsLayerHasOverrides(sharedInKeys) && body.sqlEditorShortcutsShared) {
        const fromConfig = normalizeSqlEditorShortcutsLayer(body.sqlEditorShortcutsShared)
        if (sqlEditorShortcutsLayerHasOverrides(fromConfig)) {
            persistSharedSqlEditorShortcuts(fromConfig)
        }
    }
}

export function parseSqlEditorShortcutsConfigText(text: string): SqlEditorShortcutsLayer | null {
    try {
        const parsed = JSON.parse(text) as Record<string, unknown>
        if (parsed.sqlEditorShortcutsShared) {
            return normalizeSqlEditorShortcutsLayer(parsed.sqlEditorShortcutsShared as SqlEditorShortcutsLayer)
        }
        if (parsed.sqlEditorShortcuts) {
            return normalizeSqlEditorShortcutsLayer(parsed.sqlEditorShortcuts as SqlEditorShortcutsLayer)
        }
        if (Array.isArray(parsed.snippets) || typeof parsed.autoTableAlias === 'boolean') {
            return normalizeSqlEditorShortcutsLayer(parsed as SqlEditorShortcutsLayer)
        }
        return null
    } catch {
        return null
    }
}

export function exportSharedSqlEditorShortcutsDownload(layer: SqlEditorShortcutsLayer) {
    const normalized = normalizeSqlEditorShortcutsLayer(layer)
    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<datawise-sql-snippets layer="shared">',
        `  <payload format="json"><![CDATA[${JSON.stringify(normalized)}]]></payload>`,
        '</datawise-sql-snippets>',
        '',
    ].join('\n')
    const blob = new Blob([xml], {type: 'application/xml'})
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = SQL_EDITOR_SHORTCUTS_SHARED_FILENAME
    anchor.click()
    URL.revokeObjectURL(url)
}

export async function syncSqlEditorLayersFromServer() {
    const [remoteShared, remotePersonal] = await Promise.all([
        configHttp.fetchSqlSnippets('shared').catch(() => null),
        configHttp.fetchSqlSnippets('personal').catch(() => null),
    ])

    if (remoteShared && canPersistLocalResource(UserResource.SqlSnippetsShared)) {
        localStorage.setItem(
            resolveSharedStorageKey(),
            JSON.stringify(normalizeSqlEditorShortcutsLayer(remoteShared)),
        )
    } else if (canSyncServerResource(UserResource.SqlSnippetsShared)) {
        const localShared = readSharedLayer()
        if (sqlEditorShortcutsLayerHasOverrides(localShared)) {
            await configHttp.saveSqlSnippets('shared', localShared)
        }
    }

    if (remotePersonal && canPersistLocalResource(UserResource.SqlSnippetsPersonal)) {
        writePersonalSqlEditorLayer(normalizeSqlEditorShortcutsLayer(remotePersonal))
    } else if (canSyncServerResource(UserResource.SqlSnippetsPersonal)) {
        const localPersonal = readStoredPersonalSqlEditorShortcuts()
        if (sqlEditorShortcutsLayerHasOverrides(localPersonal)) {
            await configHttp.saveSqlSnippets('personal', localPersonal)
        }
    }
}
