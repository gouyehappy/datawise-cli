import type {NavModule, ShortcutPanel} from '@/core/types'
import type {AppLocale} from '@/i18n'
import {LOCALE_STORAGE_KEY} from '@/i18n'
import type {SideRailItemId} from '@/features/layout/constants/side-rail-nav'
import {SIDE_RAIL_NAV_DEFS} from '@/features/layout/constants/side-rail-nav'
import {
    isValidAnalysisMode,
    normalizeAnalysisMode,
} from '@/features/ai/analysis/services/analysis-step.service'
import type {AiAnalysisConfigurableStepId} from '@/features/ai/types/analysis'
import {SHORTCUT_DEFINITIONS} from '@/core/shortcuts/definitions'
import type {ShortcutPreferences} from '@/core/shortcuts/types'
import {SHORTCUT_RAIL_NAV_DEFS} from '@/features/layout/constants/shortcut-rail'
import {
    DEFAULT_EDITOR_SETTINGS,
    EDITOR_FONT_SIZE_MAX,
    EDITOR_FONT_SIZE_MIN,
    EDITOR_LINE_HEIGHT_MAX,
    EDITOR_LINE_HEIGHT_MIN,
    EDITOR_STORAGE_KEY,
    MAX_RESULT_ROWS_MIN,
    MAX_RESULT_ROWS_MAX,
} from '@/features/settings/constants/editor-presets'
import {THEME_STORAGE_KEY} from '@/features/settings/constants/theme-presets'
import {readStoredEditorSettings} from '@/features/settings/services/editor-settings.service'
import {
    hydrateSqlEditorStorageFromAppConfigBody,
    readCanonicalSqlEditorLayers,
} from '@/features/settings/services/sql-editor-shortcuts.service'
import {readThemePreferencesOnBoot} from '@/features/settings/services/theme.service'
import {
    SQL_EDITOR_SHORTCUTS_SHARED_STORAGE_KEY,
    LEGACY_SQL_EDITOR_SHORTCUTS_STORAGE_KEY,
    SQL_EDITOR_SHORTCUTS_STORAGE_KEY
} from '@/features/settings/constants/sql-editor-shortcuts-presets'
import {createId} from '@/core/utils/id'
import {
    APP_CONFIG_VERSION,
    type AppConfigFile,
    type AiAnalysisLlmRouteStep,
    type AiEmbeddingProfile,
    type AiEmbeddingSettings,
    type AiLlmProfile,
    type AiLlmSettings,
    type AiPgVectorPreferences,
    type AiPreferences,
    type AiRagPreferences,
    type AiVectorStorePreference,
    type ConnectionHealthPreferences,
    type ConnectionHealthProbeIntervalMinutes,
    type DangerousSqlPreferences,
    type ExplorerPreferences,
    type LayoutPreferences,
    type PluginPreferences,
    type RestorableNavModule,
    type WindowPreferences,
    type WorkspacePreferences,
} from '@/shared/config/app-config.types'
import {
    createDefaultAppConfig,
    DEFAULT_AI_PREFERENCES,
    DEFAULT_AI_PGVECTOR_PREFERENCES,
    DEFAULT_AI_RAG_PREFERENCES,
    DEFAULT_CONNECTION_HEALTH_PREFERENCES,
    DEFAULT_DANGEROUS_SQL_PREFERENCES,
    DEFAULT_EXPLORER_PREFERENCES,
    DEFAULT_LAYOUT_PREFERENCES,
    DEFAULT_PLUGIN_PREFERENCES,
    DEFAULT_SHORTCUT_PANEL_MAX_HEIGHT,
    DEFAULT_SHORTCUT_PANEL_WIDTH,
    DEFAULT_WINDOW,
    DEFAULT_WORKSPACE_PREFERENCES,
} from '@/shared/config/app-config.defaults'
import {normalizeDashboardPreferences} from '@/features/dashboard/services/dashboard-widget.service'
import {
    AI_DEFAULT_LLM_ID,
    AI_DEFAULT_EMBEDDING_ID,
    AI_DEFAULT_COMPLETIONS_PATH,
    DEFAULT_AI_EMBEDDING_SETTINGS,
    DEFAULT_AI_LLM_SETTINGS,
    AI_DEFAULT_EMBEDDINGS_PATH,
    isAiEmbeddingProviderId,
    isAiProviderId,
    AI_EMBEDDING_DIMENSIONS_MAX,
    AI_EMBEDDING_DIMENSIONS_MIN,
    AI_MAX_TOKENS_MAX,
    AI_MAX_TOKENS_MIN,
    AI_TEMPERATURE_MAX,
    AI_TEMPERATURE_MIN,
} from '@/features/settings/constants/ai-presets'
import {CONSOLE_EDITOR_HEIGHT_MAX, CONSOLE_EDITOR_HEIGHT_MIN} from '@/features/workspace/constants/defaults'
import {
    createEmptySqlEditorShortcutsLayer,
    normalizeSqlEditorShortcutsLayer,
} from '@datawise/sql-editor/config/snippets'
import type {SqlEditorShortcutsLayer} from '@datawise/sql-editor/types'
import {
    parseAppConfigXml,
    serializeAppConfigXml,
} from '@/shared/config/app-config-xml'
import {APP_CONFIG_KEY, resolveAppConfigStorageKey} from '@/shared/config/app-config-storage-scope'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {canPersistLocalResource, canReadResource} from '@/features/auth/services/user-resource-policy'
import {
    setServerConfigSyncEnabled,
    shouldSyncConfigToServer,
} from '@/shared/config/config-server-sync'
import {cancelPendingSqlSnippetServerPersists} from '@/features/settings/services/sql-editor-shortcuts.service'
import {shouldUseBuiltinAppConfig} from '@/shared/config/app-config-read-policy'
import {configApi} from '@/api'

export {setServerConfigSyncEnabled} from '@/shared/config/config-server-sync'

export {APP_CONFIG_KEY, resolveAppConfigStorageKey, setAppConfigStorageScope} from '@/shared/config/app-config-storage-scope'
export {shouldUseBuiltinAppConfig} from '@/shared/config/app-config-read-policy'

/** @deprecated 迁移用，新配置统一写入 config/app.xml（经后端 API） */
export const LEGACY_LAYOUT_CONFIG_KEY = 'dw-layout-config'
export const APP_CONFIG_FILENAME = 'datawise-config.xml'

const RESTORABLE_MODULES: RestorableNavModule[] = ['database', 'dashboard', 'ai', 'plugin', 'pluginDev', 'connectorMarket']
const SIDE_RAIL_IDS = new Set<SideRailItemId>(SIDE_RAIL_NAV_DEFS.map((item) => item.id))
const SHORTCUT_IDS = new Set<ShortcutPanel>(SHORTCUT_RAIL_NAV_DEFS.map((item) => item.id))

let persistTimer: ReturnType<typeof setTimeout> | null = null
let serverPersistTimer: ReturnType<typeof setTimeout> | null = null

/** 取消尚未执行的 app.xml / snippets debounce 写入（登录切换、退出时调用）。 */
export function cancelDeferredConfigServerWrites(): void {
    cancelPendingAppConfigPersists()
    cancelPendingSqlSnippetServerPersists()
}

/** 取消尚未执行的本地/服务端 app 配置持久化。 */
export function cancelPendingAppConfigPersists(): void {
    if (persistTimer) {
        clearTimeout(persistTimer)
        persistTimer = null
    }
    if (serverPersistTimer) {
        clearTimeout(serverPersistTimer)
        serverPersistTimer = null
    }
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
    const num = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(num)) return fallback
    return Math.min(max, Math.max(min, num))
}

function readLocale(): AppLocale | undefined {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    return stored === 'en-US' ? 'en-US' : stored === 'zh-CN' ? 'zh-CN' : undefined
}

function mergeVisibility<T extends string>(
    partial: Partial<Record<T, boolean>> | undefined,
    ids: readonly T[],
    fallback: Partial<Record<T, boolean>>,
): Record<T, boolean> {
    const result = {} as Record<T, boolean>
    for (const id of ids) {
        result[id] = partial?.[id] ?? fallback[id] !== false
    }
    return result
}

export function normalizeLayout(raw: Partial<LayoutPreferences> | undefined): LayoutPreferences {
    const base = DEFAULT_LAYOUT_PREFERENCES
    const lastModule = RESTORABLE_MODULES.includes(raw?.lastModule as RestorableNavModule)
        ? (raw!.lastModule as RestorableNavModule)
        : base.lastModule
    const lastShortcutPanel = SHORTCUT_IDS.has(raw?.lastShortcutPanel as ShortcutPanel)
        ? (raw!.lastShortcutPanel as ShortcutPanel)
        : base.lastShortcutPanel

    return {
        sideRailVisibility: mergeVisibility(
            raw?.sideRailVisibility,
            SIDE_RAIL_NAV_DEFS.map((item) => item.id),
            base.sideRailVisibility,
        ),
        shortcutRailVisibility: mergeVisibility(
            raw?.shortcutRailVisibility,
            SHORTCUT_RAIL_NAV_DEFS.map((item) => item.id),
            base.shortcutRailVisibility,
        ),
        showExplorerPanel: raw?.showExplorerPanel ?? base.showExplorerPanel,
        explorerWidth: clamp(raw?.explorerWidth, base.explorerWidth, 200, 360),
        shortcutPanelWidth: clamp(raw?.shortcutPanelWidth, base.shortcutPanelWidth, 220, 420),
        shortcutPanelMaxHeight: clamp(
            raw?.shortcutPanelMaxHeight,
            base.shortcutPanelMaxHeight,
            280,
            560,
        ),
        showTerminalPanel: raw?.showTerminalPanel ?? base.showTerminalPanel,
        terminalHeight: clamp(raw?.terminalHeight, base.terminalHeight, 160, 520),
        lastModule,
        lastShortcutPanel,
    }
}

export function normalizeShortcuts(raw: Partial<ShortcutPreferences> | undefined): ShortcutPreferences {
    const prefs: ShortcutPreferences = {}
    for (const def of SHORTCUT_DEFINITIONS) {
        const value = raw?.[def.id]
        const trimmed = typeof value === 'string' ? value.trim() : ''
        prefs[def.id] = trimmed || def.defaultBinding
    }
    return prefs
}

export function normalizeExplorer(raw: Partial<ExplorerPreferences> | undefined): ExplorerPreferences {
    const base = DEFAULT_EXPLORER_PREFERENCES
    return {
        selectedNodeId: typeof raw?.selectedNodeId === 'string' ? raw.selectedNodeId : base.selectedNodeId,
        searchQuery: typeof raw?.searchQuery === 'string' ? raw.searchQuery : base.searchQuery,
        expandedNodeIds: Array.isArray(raw?.expandedNodeIds)
            ? raw!.expandedNodeIds.filter((id) => typeof id === 'string')
            : base.expandedNodeIds,
        showColumnComment: raw?.showColumnComment ?? base.showColumnComment,
        showTableComment: raw?.showTableComment ?? base.showTableComment,
        showSemanticLayer: raw?.showSemanticLayer ?? base.showSemanticLayer,
    }
}

export function normalizeWorkspace(raw: Partial<WorkspacePreferences> | undefined): WorkspacePreferences {
    const base = DEFAULT_WORKSPACE_PREFERENCES
    return {
        consoleEditorHeight: clamp(
            raw?.consoleEditorHeight,
            base.consoleEditorHeight,
            CONSOLE_EDITOR_HEIGHT_MIN,
            CONSOLE_EDITOR_HEIGHT_MAX,
        ),
        showConsoleResultPanel: raw?.showConsoleResultPanel ?? base.showConsoleResultPanel,
        restoreSession: raw?.restoreSession ?? base.restoreSession,
        tabs: Array.isArray(raw?.tabs) ? raw!.tabs : base.tabs,
        activeTabIndex: clamp(raw?.activeTabIndex, base.activeTabIndex, 0, 999),
    }
}

export function normalizeAiLlm(raw: Partial<AiLlmSettings> | undefined): AiLlmSettings {
    const base = DEFAULT_AI_LLM_SETTINGS
    const provider = isAiProviderId(raw?.provider) ? raw.provider : base.provider
    return {
        provider,
        baseUrl: typeof raw?.baseUrl === 'string' && raw.baseUrl.trim()
            ? raw.baseUrl.trim().replace(/\/+$/, '')
            : base.baseUrl,
        apiKey: typeof raw?.apiKey === 'string' ? raw.apiKey : base.apiKey,
        model: typeof raw?.model === 'string' && raw.model.trim() ? raw.model.trim() : base.model,
        temperature: clamp(raw?.temperature, base.temperature, AI_TEMPERATURE_MIN, AI_TEMPERATURE_MAX),
        maxTokens: clamp(raw?.maxTokens, base.maxTokens, AI_MAX_TOKENS_MIN, AI_MAX_TOKENS_MAX),
        completionsPath: normalizeApiPath(raw?.completionsPath, base.completionsPath ?? AI_DEFAULT_COMPLETIONS_PATH),
    }
}

function normalizeApiPath(raw: unknown, fallback: string): string {
    if (typeof raw !== 'string' || !raw.trim()) return fallback
    const trimmed = raw.trim()
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function normalizeAiLlmProfile(
    raw: Partial<AiLlmProfile> | undefined,
    fallbackName: string,
    fallbackId?: string,
): AiLlmProfile {
    const settings = normalizeAiLlm(raw)
    const id = typeof raw?.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : fallbackId ?? createId('llm')
    const name = typeof raw?.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : fallbackName
    return {id, name, ...settings}
}

export function normalizeAiEmbedding(raw: Partial<AiEmbeddingSettings> | undefined): AiEmbeddingSettings {
    const base = DEFAULT_AI_EMBEDDING_SETTINGS
    const provider = isAiEmbeddingProviderId(raw?.provider) ? raw.provider : base.provider
    const dimensionsRaw = raw?.dimensions
    let dimensions: number | null = null
    if (typeof dimensionsRaw === 'number' && Number.isFinite(dimensionsRaw)) {
        dimensions = clamp(
            dimensionsRaw,
            AI_EMBEDDING_DIMENSIONS_MIN,
            AI_EMBEDDING_DIMENSIONS_MIN,
            AI_EMBEDDING_DIMENSIONS_MAX,
        )
    }
    return {
        provider,
        baseUrl: typeof raw?.baseUrl === 'string' && raw.baseUrl.trim()
            ? raw.baseUrl.trim().replace(/\/+$/, '')
            : base.baseUrl,
        apiKey: typeof raw?.apiKey === 'string' ? raw.apiKey : base.apiKey,
        model: typeof raw?.model === 'string' && raw.model.trim() ? raw.model.trim() : base.model,
        dimensions,
        embeddingsPath: normalizeApiPath(raw?.embeddingsPath, base.embeddingsPath ?? AI_DEFAULT_EMBEDDINGS_PATH),
        useChatConnection: raw?.useChatConnection === true,
    }
}

export function normalizeAiEmbeddingProfile(
    raw: Partial<AiEmbeddingProfile> | undefined,
    fallbackName: string,
    fallbackId?: string,
): AiEmbeddingProfile {
    const settings = normalizeAiEmbedding(raw)
    const id = typeof raw?.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : fallbackId ?? createId('emb')
    const name = typeof raw?.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : fallbackName
    return {id, name, ...settings}
}

const AI_LLM_ROUTE_STEPS: AiAnalysisLlmRouteStep[] = ['planning', 'sql', 'python', 'summary']

function normalizeAnalysisStepLlmIds(
    raw: Partial<Record<AiAnalysisLlmRouteStep, string>> | undefined,
    profiles: AiLlmProfile[],
): Partial<Record<AiAnalysisLlmRouteStep, string>> | undefined {
    if (!raw || typeof raw !== 'object') return undefined
    const result: Partial<Record<AiAnalysisLlmRouteStep, string>> = {}
    for (const step of AI_LLM_ROUTE_STEPS) {
        const profileId = raw[step]
        if (typeof profileId === 'string' && profileId.trim() && profiles.some((profile) => profile.id === profileId)) {
            result[step] = profileId
        }
    }
    return Object.keys(result).length ? result : undefined
}

const AI_VECTOR_STORE_VALUES = ['none', 'memory', 'pgvector'] as const

function normalizeAiPgVector(raw: Partial<AiPgVectorPreferences> | undefined): AiPgVectorPreferences {
    const base = DEFAULT_AI_PGVECTOR_PREFERENCES
    return {
        jdbcUrl: typeof raw?.jdbcUrl === 'string' ? raw.jdbcUrl.trim() : base.jdbcUrl,
        username: typeof raw?.username === 'string' ? raw.username.trim() : base.username,
        password: typeof raw?.password === 'string' ? raw.password : base.password,
        table: typeof raw?.table === 'string' && raw.table.trim()
            ? raw.table.trim()
            : base.table,
    }
}

function normalizeAiRag(raw: Partial<AiRagPreferences> | undefined): AiRagPreferences {
    const base = DEFAULT_AI_RAG_PREFERENCES
    const vectorStoreRaw = typeof raw?.vectorStore === 'string' ? raw.vectorStore.trim() : ''
    const vectorStore: AiVectorStorePreference = vectorStoreRaw === ''
        ? ''
        : AI_VECTOR_STORE_VALUES.includes(vectorStoreRaw as typeof AI_VECTOR_STORE_VALUES[number])
            ? vectorStoreRaw as AiVectorStorePreference
            : base.vectorStore
    return {
        vectorStore,
        pgvector: normalizeAiPgVector(raw?.pgvector),
    }
}

export function normalizeAi(raw: Partial<AiPreferences> | undefined): AiPreferences {
    const base = DEFAULT_AI_PREFERENCES
    let sideActivePanel = base.sideActivePanel
    if (raw?.sideActivePanel === 'history' || raw?.sideActivePanel === 'scope') {
        sideActivePanel = raw.sideActivePanel
    } else {
        const legacy = raw as { sideHistoryCollapsed?: boolean; sideScopeCollapsed?: boolean } | undefined
        const historyCollapsed = legacy?.sideHistoryCollapsed === true
        const scopeCollapsed = legacy?.sideScopeCollapsed === true
        if (historyCollapsed && !scopeCollapsed) sideActivePanel = 'scope'
        else if (!historyCollapsed && scopeCollapsed) sideActivePanel = 'history'
    }

    let profiles: AiLlmProfile[]
    if (Array.isArray(raw?.llmProfiles) && raw.llmProfiles.length > 0) {
        profiles = raw.llmProfiles.map((profile, index) =>
            normalizeAiLlmProfile(profile, `Model ${index + 1}`),
        )
    } else {
        const legacyLlm = (raw as { llm?: Partial<AiLlmSettings> } | undefined)?.llm
        if (legacyLlm) {
            profiles = [
                normalizeAiLlmProfile(
                    {...legacyLlm, id: AI_DEFAULT_LLM_ID, name: 'Default'},
                    'Default',
                    AI_DEFAULT_LLM_ID,
                ),
            ]
        } else {
            profiles = base.llmProfiles.map((profile) => ({...profile}))
        }
    }

    const rawDefaultId = typeof raw?.defaultLlmId === 'string' ? raw.defaultLlmId : ''
    const defaultLlmId = profiles.some((profile) => profile.id === rawDefaultId)
        ? rawDefaultId
        : profiles[0]?.id ?? ''

    const rawWorkbenchId = typeof raw?.workbenchLlmId === 'string' ? raw.workbenchLlmId : ''
    const workbenchLlmId = profiles.some((profile) => profile.id === rawWorkbenchId)
        ? rawWorkbenchId
        : defaultLlmId

    let embeddingProfiles: AiEmbeddingProfile[]
    if (Array.isArray(raw?.embeddingProfiles) && raw.embeddingProfiles.length > 0) {
        embeddingProfiles = raw.embeddingProfiles.map((profile, index) =>
            normalizeAiEmbeddingProfile(profile, `Embedding ${index + 1}`),
        )
    } else {
        const legacyEmbedding = (raw as { embedding?: Partial<AiEmbeddingSettings> } | undefined)?.embedding
        if (legacyEmbedding) {
            embeddingProfiles = [
                normalizeAiEmbeddingProfile(
                    {...legacyEmbedding, id: AI_DEFAULT_EMBEDDING_ID, name: 'Default'},
                    'Default',
                    AI_DEFAULT_EMBEDDING_ID,
                ),
            ]
        } else {
            embeddingProfiles = base.embeddingProfiles.map((profile) => ({...profile}))
        }
    }

    const rawDefaultEmbeddingId = typeof raw?.defaultEmbeddingId === 'string' ? raw.defaultEmbeddingId : ''
    const defaultEmbeddingId = embeddingProfiles.some((profile) => profile.id === rawDefaultEmbeddingId)
        ? rawDefaultEmbeddingId
        : embeddingProfiles[0]?.id ?? ''

    return {
        sideActivePanel,
        defaultLlmId,
        workbenchLlmId,
        llmProfiles: profiles,
        analysisStepLlmIds: normalizeAnalysisStepLlmIds(raw?.analysisStepLlmIds, profiles),
        skipSqlConfirmation: raw?.skipSqlConfirmation === true,
        disabledAnalysisSteps: Array.isArray(raw?.disabledAnalysisSteps)
            ? raw.disabledAnalysisSteps.filter(
                (step): step is AiAnalysisConfigurableStepId =>
                    typeof step === 'string'
                    && (['planner', 'evidence', 'sql_validate', 'python', 'chart', 'summary', 'report'] as const).includes(
                        step as AiAnalysisConfigurableStepId,
                    ),
            )
            : base.disabledAnalysisSteps ?? [],
        analysisMode: isValidAnalysisMode(raw?.analysisMode)
            ? raw.analysisMode
            : normalizeAnalysisMode(base.analysisMode),
        defaultEmbeddingId,
        embeddingProfiles,
        rag: normalizeAiRag(raw?.rag),
    }
}

export function normalizeWindow(raw: Partial<WindowPreferences> | undefined): WindowPreferences {
    const base = DEFAULT_WINDOW
    const normalizeCoordinate = (value: unknown): number | null =>
        typeof value === 'number' && Number.isFinite(value) ? value : null
    return {
        width: clamp(raw?.width, base.width, 900, 3840),
        height: clamp(raw?.height, base.height, 600, 2160),
        x: normalizeCoordinate(raw?.x),
        y: normalizeCoordinate(raw?.y),
        maximized: raw?.maximized ?? base.maximized,
    }
}

type AppConfigInput = Omit<Partial<AppConfigFile>, 'layout'> & {
    layout?: Partial<LayoutPreferences>
}

function normalizePlugins(raw: PluginPreferences | undefined): PluginPreferences {
    const enabled: PluginPreferences['enabled'] = {}
    if (raw?.enabled && typeof raw.enabled === 'object') {
        for (const [id, value] of Object.entries(raw.enabled)) {
            if (typeof value === 'boolean') enabled[id] = value
        }
    }
    const presetIds = ['dba', 'readOnlyAnalysis', 'teamViewer', 'developer', 'minimal'] as const
    const referencePresetId =
        typeof raw?.referencePresetId === 'string'
        && (presetIds as readonly string[]).includes(raw.referencePresetId)
            ? raw.referencePresetId
            : undefined
    return referencePresetId ? {enabled, referencePresetId} : {enabled}
}

const PROBE_INTERVALS: ConnectionHealthProbeIntervalMinutes[] = [1, 5, 15, 30]

function normalizeConnectionHealth(
    raw: Partial<ConnectionHealthPreferences> | undefined,
): ConnectionHealthPreferences {
    const base = DEFAULT_CONNECTION_HEALTH_PREFERENCES
    const watched = Array.isArray(raw?.watchedConnectionIds)
        ? raw.watchedConnectionIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : base.watchedConnectionIds
    const interval = PROBE_INTERVALS.includes(raw?.probeIntervalMinutes as ConnectionHealthProbeIntervalMinutes)
        ? (raw!.probeIntervalMinutes as ConnectionHealthProbeIntervalMinutes)
        : base.probeIntervalMinutes
    return {
        alertsEnabled: raw?.alertsEnabled ?? base.alertsEnabled,
        drawerAlertsEnabled: raw?.drawerAlertsEnabled ?? base.drawerAlertsEnabled,
        slowQueryAlertsEnabled: raw?.slowQueryAlertsEnabled ?? base.slowQueryAlertsEnabled,
        probeIntervalMinutes: interval,
        alertOnOkToError: raw?.alertOnOkToError ?? base.alertOnOkToError,
        alertOnUnknownToError: raw?.alertOnUnknownToError ?? base.alertOnUnknownToError,
        watchedConnectionIds: watched,
    }
}

function normalizeDangerousSql(
    raw: Partial<DangerousSqlPreferences> | undefined,
): DangerousSqlPreferences {
    const base = DEFAULT_DANGEROUS_SQL_PREFERENCES
    const whitelistedTables = Array.isArray(raw?.whitelistedTables)
        ? raw.whitelistedTables
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean)
        : base.whitelistedTables
    return {
        confirmEnabled: raw?.confirmEnabled ?? base.confirmEnabled,
        whitelistedTables,
    }
}

export function normalizeAppConfig(raw: AppConfigInput | undefined): AppConfigFile {
    const defaults = createDefaultAppConfig()
    if (!raw) return defaults
    return {
        version: APP_CONFIG_VERSION,
        exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : defaults.exportedAt,
        locale: raw.locale === 'en-US' || raw.locale === 'zh-CN' ? raw.locale : readLocale(),
        theme: raw.theme ?? readThemePreferencesOnBoot(),
        editor: raw.editor ?? readStoredEditorSettings(),
        window: normalizeWindow(raw.window),
        layout: normalizeLayout(raw.layout),
        explorer: normalizeExplorer(raw.explorer),
        workspace: normalizeWorkspace(raw.workspace),
        profile: raw.profile,
        ai: normalizeAi(raw.ai),
        plugins: normalizePlugins(raw.plugins ?? defaults.plugins),
        connectionHealth: normalizeConnectionHealth(raw.connectionHealth ?? defaults.connectionHealth),
        dangerousSql: normalizeDangerousSql(raw.dangerousSql ?? defaults.dangerousSql),
        dashboard: normalizeDashboardPreferences(raw.dashboard ?? defaults.dashboard),
        shortcuts: normalizeShortcuts(raw.shortcuts),
        // 导入/导出信封字段；本地运行时以专用 localStorage key 为准（见 attachCanonicalSqlEditorLayers）
        sqlEditorShortcutsShared: normalizeSqlEditorShortcutsLayer(raw.sqlEditorShortcutsShared),
        sqlEditorShortcuts: normalizeSqlEditorShortcutsLayer(raw.sqlEditorShortcuts),
    }
}

/** 本地运行时：sql-editor 层始终来自专用 key，而非 dw-app-config 内嵌副本 */
function attachCanonicalSqlEditorLayers(config: AppConfigFile): AppConfigFile {
    const {personal, shared} = readCanonicalSqlEditorLayers()
    return {
        ...config,
        sqlEditorShortcutsShared: shared,
        sqlEditorShortcuts: personal,
    }
}

/** 在 sql-editor store 初始化前调用，将 app-config 内嵌层一次性迁入专用 key */
export function bootstrapSqlEditorLayersFromStoredAppConfig(): void {
    try {
        const raw = localStorage.getItem(resolveAppConfigStorageKey())
        if (!raw) return
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const version = parsed.version
        if (version !== 1 && version !== 2) return
        hydrateSqlEditorStorageFromAppConfigBody(parsed as Partial<AppConfigFile>)
    } catch {
        /* ignore */
    }
}

function readLegacyLayoutOnly(): Partial<LayoutPreferences> | undefined {
    try {
        const raw = localStorage.getItem(LEGACY_LAYOUT_CONFIG_KEY)
        if (!raw) return undefined
        return JSON.parse(raw) as Partial<LayoutPreferences>
    } catch {
        return undefined
    }
}

export function readAppConfig(): AppConfigFile {
    if (shouldUseBuiltinAppConfig()) {
        return attachCanonicalSqlEditorLayers(createDefaultAppConfig())
    }
    try {
        const raw = localStorage.getItem(resolveAppConfigStorageKey())
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<AppConfigFile>
            if (parsed.version === 2 || parsed.version === 1) {
                hydrateSqlEditorStorageFromAppConfigBody(parsed)
                return attachCanonicalSqlEditorLayers(normalizeAppConfig(parsed))
            }
        }
    } catch {
        /* fall through to legacy merge */
    }

    const legacyLayout = readLegacyLayoutOnly()
    return attachCanonicalSqlEditorLayers(
        normalizeAppConfig({
            version: APP_CONFIG_VERSION,
            exportedAt: new Date().toISOString(),
            locale: readLocale(),
            theme: readThemePreferencesOnBoot(),
            editor: readStoredEditorSettings(),
            layout: legacyLayout,
            window: DEFAULT_WINDOW,
            explorer: DEFAULT_EXPLORER_PREFERENCES,
            workspace: DEFAULT_WORKSPACE_PREFERENCES,
            ai: DEFAULT_AI_PREFERENCES,
        }),
    )
}

export function persistAppConfig(config: AppConfigFile) {
    if (canPersistLocalResource(UserResource.AppConfig)) {
        localStorage.setItem(resolveAppConfigStorageKey(), JSON.stringify(normalizeAppConfig(config)))
        localStorage.removeItem(LEGACY_LAYOUT_CONFIG_KEY)
    }
    schedulePersistAppConfigToServer(config)
}

export function schedulePersistAppConfigToServer(config: AppConfigFile) {
    if (!shouldSyncConfigToServer()) return
    if (serverPersistTimer) clearTimeout(serverPersistTimer)
    serverPersistTimer = setTimeout(() => {
        if (!shouldSyncConfigToServer()) return
        void configApi.saveAppConfig(normalizeAppConfig(config)).catch((error) => {
            console.warn('[config] failed to persist app.xml', error)
        })
    }, 420)
}

export async function fetchAppConfigFromServer(): Promise<AppConfigFile | null> {
    try {
        const remote = await configApi.fetchAppConfig()
        return remote ? normalizeAppConfig(remote) : null
    } catch {
        return null
    }
}

export async function pushLocalAppConfigToServer(config: AppConfigFile): Promise<void> {
    if (!shouldSyncConfigToServer()) return
    await configApi.saveAppConfig(normalizeAppConfig(config))
}

export function schedulePersistAppConfig(config: AppConfigFile) {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => persistAppConfig(config), 280)
}

/** @deprecated 使用 readAppConfig().layout */
export function readLayoutPreferences(): LayoutPreferences {
    return readAppConfig().layout
}

/** @deprecated 使用 persistAppConfig */
export function persistLayoutPreferences(prefs: LayoutPreferences) {
    const current = readAppConfig()
    persistAppConfig({...current, layout: normalizeLayout(prefs)})
}

export function isSideRailItemVisible(prefs: LayoutPreferences, id: SideRailItemId): boolean {
    return prefs.sideRailVisibility[id] !== false
}

export function isShortcutRailItemVisible(prefs: LayoutPreferences, id: ShortcutPanel): boolean {
    return prefs.shortcutRailVisibility[id] !== false
}

export function hasVisibleShortcutRailItem(prefs: LayoutPreferences): boolean {
    return SHORTCUT_RAIL_NAV_DEFS.some((item) => isShortcutRailItemVisible(prefs, item.id))
}

export function buildAppConfigFile(config = readAppConfig()): AppConfigFile {
    return normalizeAppConfig(config)
}

export function exportAppConfigDownload(config?: AppConfigFile) {
    const file = buildAppConfigFile(config ?? readAppConfig())
    const blob = new Blob([serializeAppConfigXml(file)], {type: 'application/xml'})
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = APP_CONFIG_FILENAME
    anchor.click()
    URL.revokeObjectURL(url)
}

function normalizeImportedConfig(raw: unknown): AppConfigFile | null {
    if (!raw || typeof raw !== 'object') return null
    const data = raw as Partial<AppConfigFile>
    if ((data.version !== 2 && data.version !== 1) || !data.layout) return null
    return normalizeAppConfig(data)
}

export function parseAppConfigFile(text: string): AppConfigFile | null {
    const trimmed = text.trim()
    if (trimmed.startsWith('<')) {
        return normalizeImportedConfig(parseAppConfigXml(text))
    }
    try {
        return normalizeImportedConfig(JSON.parse(text))
    } catch {
        return null
    }
}

export type ApplyAppConfigHandlers = {
    applyLocale?: (locale: AppLocale) => void
    applyTheme?: (theme: NonNullable<AppConfigFile['theme']>) => void
    applyEditor?: (editor: NonNullable<AppConfigFile['editor']>) => void
    applyWindow?: (window: WindowPreferences) => void
    applyLayout: (layout: LayoutPreferences) => void
    applyExplorer?: (explorer: ExplorerPreferences) => void
    applyWorkspace?: (workspace: WorkspacePreferences) => void
    applyProfile?: (profile: NonNullable<AppConfigFile['profile']>) => void
    applyAi?: (ai: AiPreferences) => void
    applyShortcuts?: (shortcuts: ShortcutPreferences) => void
    applySqlEditorShortcutsShared?: (shortcuts: SqlEditorShortcutsLayer) => void
    applySqlEditorShortcuts?: (shortcuts: SqlEditorShortcutsLayer) => void
}

export function applyAppConfigFile(file: AppConfigFile, handlers: ApplyAppConfigHandlers) {
    const normalized = normalizeAppConfig(file)
    if (normalized.locale && handlers.applyLocale) handlers.applyLocale(normalized.locale)
    if (normalized.theme && handlers.applyTheme) handlers.applyTheme(normalized.theme)
    if (normalized.editor && handlers.applyEditor) handlers.applyEditor(normalized.editor)
    if (normalized.window && handlers.applyWindow) handlers.applyWindow(normalized.window)
    handlers.applyLayout(normalized.layout)
    if (normalized.explorer && handlers.applyExplorer) handlers.applyExplorer(normalized.explorer)
    if (normalized.workspace && handlers.applyWorkspace) handlers.applyWorkspace(normalized.workspace)
    if (normalized.profile && handlers.applyProfile) handlers.applyProfile(normalized.profile)
    if (normalized.ai && handlers.applyAi) handlers.applyAi(normalized.ai)
    if (normalized.shortcuts && handlers.applyShortcuts) handlers.applyShortcuts(normalized.shortcuts)
    if (normalized.sqlEditorShortcutsShared && handlers.applySqlEditorShortcutsShared) {
        handlers.applySqlEditorShortcutsShared(normalized.sqlEditorShortcutsShared)
    }
    if (normalized.sqlEditorShortcuts && handlers.applySqlEditorShortcuts) {
        handlers.applySqlEditorShortcuts(normalized.sqlEditorShortcuts)
    }
}

export function pickRestorableModule(prefs: LayoutPreferences): RestorableNavModule {
    if (isSideRailItemVisible(prefs, prefs.lastModule)) return prefs.lastModule
    const fallback = SIDE_RAIL_NAV_DEFS.find(
        (item) => item.section === 'main' && isSideRailItemVisible(prefs, item.id),
    )
    return (fallback?.id as RestorableNavModule) ?? 'database'
}

export function sanitizeEditorSettings(
    editor: NonNullable<AppConfigFile['editor']>,
): typeof DEFAULT_EDITOR_SETTINGS {
    const stored = readStoredEditorSettings()
    return {
        ...stored,
        ...editor,
        fontSize: clamp(editor.fontSize, stored.fontSize, EDITOR_FONT_SIZE_MIN, EDITOR_FONT_SIZE_MAX),
        lineHeight: clamp(editor.lineHeight, stored.lineHeight, EDITOR_LINE_HEIGHT_MIN, EDITOR_LINE_HEIGHT_MAX),
        maxResultRows: clamp(editor.maxResultRows, stored.maxResultRows, MAX_RESULT_ROWS_MIN, MAX_RESULT_ROWS_MAX),
    }
}

export function migrateLegacyStorageKeysOnce() {
    if (localStorage.getItem(APP_CONFIG_KEY)) return
    const hasLegacy =
        localStorage.getItem(LEGACY_LAYOUT_CONFIG_KEY)
        || localStorage.getItem(THEME_STORAGE_KEY)
        || localStorage.getItem(EDITOR_STORAGE_KEY)
        || localStorage.getItem(LEGACY_SQL_EDITOR_SHORTCUTS_STORAGE_KEY)
        || localStorage.getItem(SQL_EDITOR_SHORTCUTS_STORAGE_KEY)
        || localStorage.getItem(SQL_EDITOR_SHORTCUTS_SHARED_STORAGE_KEY)
        || localStorage.getItem(LOCALE_STORAGE_KEY)
    if (!hasLegacy) return
    persistAppConfig(readAppConfig())
}
