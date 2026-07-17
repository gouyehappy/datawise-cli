/**
 * 应用配置 Store（Pinia）
 *
 * 统一管理应用配置：本地 localStorage 缓存 + 服务端 config/*.xml 持久化。
 * 布局可见性、窗口尺寸、Explorer/Workspace 快照、AI LLM 设置、快捷键等。
 *
 * 与 theme-store / editor-settings / shortcut-settings 双向同步；
 * 设置页「导入/导出配置」亦经此 Store。
 */
import {defineStore} from 'pinia'
import {computed, ref, toRaw, watch} from 'vue'
import type {SettingsSection, ShortcutPanel} from '@/core/types'
import {currentLocale, setLocale, type AppLocale} from '@/i18n'
import type {SideRailItemId} from '@/features/layout/constants/side-rail-nav'
import {SIDE_RAIL_NAV_DEFS} from '@/features/layout/constants/side-rail-nav'
import {SHORTCUT_RAIL_NAV_DEFS} from '@/features/layout/constants/shortcut-rail'
import {applyExpandedNodeIds, collectExpandedNodeIds} from '@/features/explorer/utils/tree-session'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useShortcutSettingsStore} from '@/features/settings/stores/shortcut-settings-store'
import {useSqlEditorShortcutsStore} from '@/features/settings/stores/sql-editor-shortcuts-store'
import {useEditorSettingsStore} from '@/features/settings/stores/editor-settings'
import {useThemeStore} from '@/features/settings/stores/theme-store'
import type {
    AiAnalysisLlmRouteStep,
    AppConfigFile,
    AiEmbeddingProfile,
    AiEmbeddingSettings,
    AiLlmProfile,
    AiPreferences,
    AiRagPreferences,
    ConnectionHealthPreferences,
    DangerousSqlPreferences,
    DashboardPreferences,
    LayoutPreferences,
    PluginPreferences,
    RestorableNavModule,
    WindowPreferences
} from '@/shared/config/app-config.types'
import {
    createDefaultAppConfig,
    DEFAULT_AI_PREFERENCES,
    DEFAULT_AI_RAG_PREFERENCES,
    DEFAULT_CONNECTION_HEALTH_PREFERENCES,
    DEFAULT_DANGEROUS_SQL_PREFERENCES,
    DEFAULT_DASHBOARD_PREFERENCES,
    DEFAULT_PLUGIN_PREFERENCES
} from '@/shared/config/app-config.defaults'
import {normalizeDashboardPreferences} from '@/features/dashboard/services/dashboard-widget.service'
import {createAiEmbeddingProfile, createAiLlmProfile} from '@/features/settings/constants/ai-presets'
import {aiApi} from '@/api'
import {mergePluginsOnAppConfigImport} from '@/features/plugin/services/plugin-app-config-merge.service'
import {
    isShortcutPanelEnabled,
    resolvePluginEnabled,
} from '@/features/plugin/services/plugin-registry.service'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {
    applyAppConfigFile,
    bootstrapSqlEditorLayersFromStoredAppConfig,
    exportAppConfigDownload,
    fetchAppConfigFromServer,
    isShortcutRailItemVisible,
    isSideRailItemVisible,
    migrateLegacyStorageKeysOnce,
    normalizeAppConfig,
    parseAppConfigFile,
    persistAppConfig,
    pickAccessibleNavModule,
    pushLocalAppConfigToServer,
    readAppConfig,
    resolveHomeNavModule,
    sanitizeEditorSettings,
    schedulePersistAppConfig,
} from '@/shared/config/app-config.service'
import {readGuestFlag} from '@/shared/auth/session'
import {
    canAccessFeature,
    settingsSectionFeatureKey,
    shortcutFeatureKey,
    sideRailFeatureKey,
} from '@/features/auth/services/feature-permission.service'
import {FeaturePermission} from '@/features/auth/types/feature-permission.types'
import {syncSqlEditorLayersFromServer} from '@/features/settings/services/sql-editor-shortcuts.service'
import {syncUpdatePreferencesFromServer} from '@/features/settings/services/about-settings.service'
import {useUpdateSettingsStore} from '@/features/settings/stores/update-settings'
import {setupElectronWindowSync} from '@/features/layout/composables/useElectronWindowSync'
import {toWindowStatePayload} from '@/features/layout/services/electron-window-state.service'

export const useAppConfigStore = defineStore('app-config', () => {
    migrateLegacyStorageKeysOnce()
    bootstrapSqlEditorLayersFromStoredAppConfig()

    const layout = useLayoutStore()
    const explorer = useExplorerStore()
    const workspace = useWorkspaceStore()
    const theme = useThemeStore()
    const editor = useEditorSettingsStore()
    const shortcutSettings = useShortcutSettingsStore()
    const sqlEditorShortcuts = useSqlEditorShortcutsStore()

    const config = ref<AppConfigFile>(readAppConfig())
    /** 结果面板展开状态仅会话内有效；配置加载时重置为收起 */
    const showConsoleResultPanel = ref(false)
    let syncing = false
    let heavyPersistTimer: ReturnType<typeof setTimeout> | null = null
    let lightPersistTimer: ReturnType<typeof setTimeout> | null = null
    const HEAVY_PERSIST_DELAY_MS = 700
    const LIGHT_PERSIST_DELAY_MS = 320

    /** 读 config 内插件开关，避免 init 期间 app-config ↔ plugin store 循环依赖 */
    function isPluginEnabledFromConfig(pluginId: string): boolean {
        return resolvePluginEnabled(pluginId, [], config.value.plugins?.enabled ?? {})
    }

    const preferences = computed(() => config.value.layout)
    const aiPreferences = computed(() => config.value.ai ?? DEFAULT_AI_PREFERENCES)
    const connectionHealthPreferences = computed(
        () => config.value.connectionHealth ?? DEFAULT_CONNECTION_HEALTH_PREFERENCES,
    )
    const dangerousSqlPreferences = computed(
        () => config.value.dangerousSql ?? DEFAULT_DANGEROUS_SQL_PREFERENCES,
    )
    const dashboardPreferences = computed(
        () => config.value.dashboard ?? DEFAULT_DASHBOARD_PREFERENCES,
    )

    const defaultLlmProfile = computed(() => {
        const ai = aiPreferences.value
        return ai.llmProfiles.find((profile) => profile.id === ai.defaultLlmId) ?? ai.llmProfiles[0]
    })

    const workbenchLlmProfile = computed(() => {
        const ai = aiPreferences.value
        const activeId = ai.workbenchLlmId || ai.defaultLlmId
        return ai.llmProfiles.find((profile) => profile.id === activeId) ?? ai.llmProfiles[0]
    })

    const defaultEmbeddingProfile = computed(() => {
        const ai = aiPreferences.value
        return ai.embeddingProfiles.find((profile) => profile.id === ai.defaultEmbeddingId)
            ?? ai.embeddingProfiles[0]
    })

    function patchAiPreferences(patch: Partial<AiPreferences>) {
        const next = {...aiPreferences.value, ...patch}
        config.value = {
            ...config.value,
            ai: next,
        }
        aiApi.syncPreferences(next)
        persistSoon()
    }

    function replaceLlmProfiles(
        profiles: AiLlmProfile[],
        defaultLlmId?: string,
        workbenchLlmId?: string,
    ) {
        const nextDefault = defaultLlmId && profiles.some((profile) => profile.id === defaultLlmId)
            ? defaultLlmId
            : profiles[0]?.id ?? ''
        const currentWorkbench = aiPreferences.value.workbenchLlmId
        const nextWorkbench = workbenchLlmId && profiles.some((profile) => profile.id === workbenchLlmId)
            ? workbenchLlmId
            : profiles.some((profile) => profile.id === currentWorkbench)
                ? currentWorkbench
                : nextDefault
        patchAiPreferences({
            llmProfiles: profiles,
            defaultLlmId: nextDefault,
            workbenchLlmId: nextWorkbench,
        })
    }

    function updateLlmProfile(id: string, patch: Partial<AiLlmProfile>) {
        const profiles = aiPreferences.value.llmProfiles.map((profile) =>
            profile.id === id ? {...profile, ...patch, id: profile.id} : profile,
        )
        replaceLlmProfiles(profiles)
    }

    function addLlmProfile(name: string): string {
        const profile = createAiLlmProfile(name)
        replaceLlmProfiles([...aiPreferences.value.llmProfiles, profile])
        return profile.id
    }

    function removeLlmProfile(id: string) {
        const profiles = aiPreferences.value.llmProfiles
        if (profiles.length <= 1) return
        const nextProfiles = profiles.filter((profile) => profile.id !== id)
        const nextDefault = aiPreferences.value.defaultLlmId === id
            ? nextProfiles[0].id
            : aiPreferences.value.defaultLlmId
        const nextWorkbench = aiPreferences.value.workbenchLlmId === id
            ? nextProfiles[0].id
            : aiPreferences.value.workbenchLlmId
        replaceLlmProfiles(nextProfiles, nextDefault, nextWorkbench)
    }

    function setDefaultLlmProfile(id: string) {
        if (!aiPreferences.value.llmProfiles.some((profile) => profile.id === id)) return
        patchAiPreferences({defaultLlmId: id})
    }

    function setWorkbenchLlmProfile(id: string) {
        if (!aiPreferences.value.llmProfiles.some((profile) => profile.id === id)) return
        patchAiPreferences({workbenchLlmId: id})
    }

    function replaceEmbeddingProfiles(
        profiles: AiEmbeddingProfile[],
        defaultEmbeddingId?: string,
    ) {
        const nextDefault = defaultEmbeddingId && profiles.some((profile) => profile.id === defaultEmbeddingId)
            ? defaultEmbeddingId
            : profiles[0]?.id ?? ''
        patchAiPreferences({
            embeddingProfiles: profiles,
            defaultEmbeddingId: nextDefault,
        })
    }

    function updateEmbeddingProfile(id: string, patch: Partial<AiEmbeddingProfile>) {
        const profiles = aiPreferences.value.embeddingProfiles.map((profile) =>
            profile.id === id ? {...profile, ...patch, id: profile.id, useChatConnection: false} : profile,
        )
        replaceEmbeddingProfiles(profiles)
    }

    function addEmbeddingProfile(name: string): string {
        const profile = createAiEmbeddingProfile(name)
        replaceEmbeddingProfiles([...aiPreferences.value.embeddingProfiles, profile])
        return profile.id
    }

    function removeEmbeddingProfile(id: string) {
        const profiles = aiPreferences.value.embeddingProfiles
        if (profiles.length <= 1) return
        const nextProfiles = profiles.filter((profile) => profile.id !== id)
        const nextDefault = aiPreferences.value.defaultEmbeddingId === id
            ? nextProfiles[0].id
            : aiPreferences.value.defaultEmbeddingId
        replaceEmbeddingProfiles(nextProfiles, nextDefault)
    }

    function setDefaultEmbeddingProfile(id: string) {
        if (!aiPreferences.value.embeddingProfiles.some((profile) => profile.id === id)) return
        patchAiPreferences({defaultEmbeddingId: id})
    }

    function insertLlmProfile(profile: AiLlmProfile) {
        replaceLlmProfiles([...aiPreferences.value.llmProfiles, profile])
    }

    function insertEmbeddingProfile(profile: AiEmbeddingProfile) {
        replaceEmbeddingProfiles([...aiPreferences.value.embeddingProfiles, profile])
    }

    function patchRagPreferences(patch: Partial<AiRagPreferences>) {
        const current = toRaw(aiPreferences.value.rag ?? DEFAULT_AI_RAG_PREFERENCES)
        patchAiPreferences({
            rag: {
                ...current,
                ...patch,
                pgvector: patch.pgvector
                    ? {...toRaw(current.pgvector), ...patch.pgvector}
                    : toRaw(current.pgvector),
            },
        })
    }

    function persistConfigNow() {
        persistNow()
    }

    async function persistConfigNowAsync() {
        flushHeavyPersist()
        config.value = captureConfig()
        persistAppConfig(config.value)
        await pushLocalAppConfigToServer(config.value)
    }

    function setAiSideActivePanel(panel: AiPreferences['sideActivePanel']) {
        patchAiPreferences({sideActivePanel: panel})
    }

    function patchConnectionHealth(patch: Partial<ConnectionHealthPreferences>) {
        config.value = {
            ...config.value,
            connectionHealth: {...connectionHealthPreferences.value, ...patch},
        }
        persistSoon()
    }

    function patchDangerousSql(patch: Partial<DangerousSqlPreferences>) {
        config.value = {
            ...config.value,
            dangerousSql: {...dangerousSqlPreferences.value, ...patch},
        }
        persistSoon()
    }

    function patchDashboardPreferences(next: DashboardPreferences) {
        config.value = {
            ...config.value,
            dashboard: normalizeDashboardPreferences(next),
        }
        persistSoon()
    }

    function resetDashboardPreferences() {
        patchDashboardPreferences(DEFAULT_DASHBOARD_PREFERENCES)
    }

    function patchPlugins(next: Partial<PluginPreferences>) {
        const current = config.value.plugins ?? DEFAULT_PLUGIN_PREFERENCES
        const plugins: PluginPreferences = {
            enabled: next.enabled !== undefined ? {...next.enabled} : {...current.enabled},
        }
        const referencePresetId =
            next.referencePresetId !== undefined ? next.referencePresetId : current.referencePresetId
        if (referencePresetId) plugins.referencePresetId = referencePresetId
        config.value = {
            ...config.value,
            plugins,
        }
        persistSoon()
    }

    function captureConfig(): AppConfigFile {
        const session = workspace.captureSession()
        return normalizeAppConfig({
            ...config.value,
            exportedAt: new Date().toISOString(),
            locale: currentLocale.value,
            theme: {
                appearance: theme.appearance,
                background: theme.backgroundTone,
                primary: theme.primaryTone,
                uiSkin: theme.uiSkin,
            },
            editor: {...editor.settings},
            layout: snapshotLayoutPreferences(),
            explorer: {
                selectedNodeId: explorer.selectedNodeId,
                searchQuery: explorer.searchQuery,
                expandedNodeIds: collectExpandedNodeIds(explorer.tree),
                showColumnComment: explorer.showColumnComment,
                showTableComment: explorer.showTableComment,
                showSemanticLayer: explorer.showSemanticLayer,
            },
            workspace: {
                ...(config.value.workspace ?? {
                    restoreSession: true,
                    tabs: [],
                    activeTabIndex: 0,
                    consoleEditorHeight: 400,
                }),
                tabs: session.tabs,
                activeTabIndex: session.activeTabIndex >= 0 ? session.activeTabIndex : 0,
                consoleEditorHeight: config.value.workspace?.consoleEditorHeight ?? 400,
                // 结果面板展开态不落盘；下次打开工作台始终从收起条开始
                showConsoleResultPanel: false,
            },
            profile: {
                name: layout.profileName,
                email: layout.profileEmail,
            },
            ai: aiPreferences.value,
            connectionHealth: connectionHealthPreferences.value,
            dangerousSql: dangerousSqlPreferences.value,
            dashboard: dashboardPreferences.value,
            shortcuts: shortcutSettings.snapshot(),
            sqlEditorShortcutsShared: sqlEditorShortcuts.sharedSnapshot(),
            sqlEditorShortcuts: sqlEditorShortcuts.personalSnapshot(),
        })
    }

    function persistSoon() {
        if (syncing) return
        config.value = captureConfig()
        schedulePersistAppConfig(config.value)
    }

    function resolvePersistedLastModule() {
        const module = layout.activeModule
        if (
            module === 'database'
            || module === 'dashboard'
            || module === 'ai'
            || module === 'plugin'
            || module === 'pluginDev'
            || module === 'connectorMarket'
        ) {
            return resolveHomeNavModule(module as RestorableNavModule)
        }
        return config.value.layout.lastModule
    }

    function snapshotLayoutPreferences(): LayoutPreferences {
        return {
            ...config.value.layout,
            explorerWidth: explorer.width,
            showTerminalPanel: layout.showTerminalPanel,
            terminalHeight: layout.terminalHeight,
            lastModule: resolvePersistedLastModule(),
            lastShortcutPanel: layout.activeShortcutPanel,
        }
    }

    /** 导航/布局切换：只更新 layout，避免每次点击全量 capture 工作区 SQL。 */
    function scheduleLayoutPersist() {
        if (syncing) return
        if (lightPersistTimer) clearTimeout(lightPersistTimer)
        lightPersistTimer = setTimeout(() => {
            lightPersistTimer = null
            if (syncing) return
            config.value = {
                ...config.value,
                layout: snapshotLayoutPreferences(),
            }
            schedulePersistAppConfig(config.value)
        }, LIGHT_PERSIST_DELAY_MS)
    }

    /** Explorer 选中/搜索等：只更新 explorer 字段，不遍历整棵树。 */
    function scheduleExplorerPersist() {
        if (syncing) return
        if (lightPersistTimer) clearTimeout(lightPersistTimer)
        lightPersistTimer = setTimeout(() => {
            lightPersistTimer = null
            if (syncing) return
            const current = config.value.explorer
            config.value = {
                ...config.value,
                explorer: {
                    selectedNodeId: explorer.selectedNodeId,
                    searchQuery: explorer.searchQuery,
                    expandedNodeIds: current?.expandedNodeIds ?? [],
                    showColumnComment: explorer.showColumnComment,
                    showTableComment: explorer.showTableComment,
                    showSemanticLayer: explorer.showSemanticLayer,
                },
            }
            schedulePersistAppConfig(config.value)
        }, LIGHT_PERSIST_DELAY_MS)
    }

    function scheduleProfilePersist() {
        if (syncing) return
        if (lightPersistTimer) clearTimeout(lightPersistTimer)
        lightPersistTimer = setTimeout(() => {
            lightPersistTimer = null
            if (syncing) return
            config.value = {
                ...config.value,
                profile: {
                    name: layout.profileName,
                    email: layout.profileEmail,
                },
            }
            schedulePersistAppConfig(config.value)
        }, LIGHT_PERSIST_DELAY_MS)
    }

    /** Explorer 树 / Workspace Tab SQL 等高频变更：合并 capture，避免每次按键全量序列化 */
    function persistHeavySoon() {
        if (syncing) return
        if (heavyPersistTimer) clearTimeout(heavyPersistTimer)
        heavyPersistTimer = setTimeout(() => {
            heavyPersistTimer = null
            if (syncing) return
            config.value = captureConfig()
            schedulePersistAppConfig(config.value)
        }, HEAVY_PERSIST_DELAY_MS)
    }

    function flushHeavyPersist() {
        if (!heavyPersistTimer) return
        clearTimeout(heavyPersistTimer)
        heavyPersistTimer = null
        if (syncing) return
        config.value = captureConfig()
        schedulePersistAppConfig(config.value)
    }

    function persistNow() {
        flushHeavyPersist()
        config.value = captureConfig()
        persistAppConfig(config.value)
    }

    function isMainModuleAccessible(id: SideRailItemId, prefs: LayoutPreferences = preferences.value): boolean {
        if (!isSideRailItemVisible(prefs, id)) return false
        if (id === 'ai' && !isPluginEnabledFromConfig('p-ai-workbench')) return false
        const feature = sideRailFeatureKey(id)
        if (feature && !canAccessFeature(feature)) return false
        return true
    }

    function pickAccessibleModule(prefs: LayoutPreferences = preferences.value): RestorableNavModule {
        return pickAccessibleNavModule(prefs, (id) => isMainModuleAccessible(id, prefs))
    }

    function applyLayoutEffects(next: LayoutPreferences) {
        config.value = {...config.value, layout: next}
        explorer.width = next.explorerWidth
        layout.showTerminalPanel = next.showTerminalPanel
        layout.setTerminalHeight(next.terminalHeight)

        if (next.lastShortcutPanel && isShortcutAccessible(next.lastShortcutPanel, next)) {
            layout.activeShortcutPanel = next.lastShortcutPanel
        } else if (
            layout.activeShortcutPanel
            && !isShortcutAccessible(layout.activeShortcutPanel, next)
        ) {
            layout.activeShortcutPanel = null
        }

        const module = pickAccessibleModule(next)
        if (layout.activeModule !== 'settings' && layout.activeModule !== 'team') {
            layout.setModule(module)
        }

        if (!isSideRailItemVisible(next, 'notify')) layout.showNotificationDrawer = false
        if (!isSideRailItemVisible(next, 'terminal') && layout.showTerminalPanel) {
            layout.closeTerminalPanel()
        }
    }

    function applyLayoutState(next: LayoutPreferences) {
        applyLayoutEffects(next)
        persistSoon()
    }

    function applyFullConfig(next: AppConfigFile) {
        syncing = true
        const normalized = normalizeAppConfig(next)
        config.value = normalized

        applyAppConfigFile(normalized, {
            applyLocale: (locale: AppLocale) => setLocale(locale),
            applyEditor: (settings) => editor.patchSettings(sanitizeEditorSettings(settings)),
            applyWindow: (windowPrefs) => {
                config.value.window = windowPrefs
                void globalThis.window.datawise?.window?.setState?.(toWindowStatePayload(windowPrefs))
            },
            applyLayout: (layoutPrefs) => applyLayoutEffects(layoutPrefs),
            applyExplorer: (explorerPrefs) => {
                explorer.selectedNodeId = explorerPrefs.selectedNodeId
                explorer.searchQuery = explorerPrefs.searchQuery
                explorer.showColumnComment = explorerPrefs.showColumnComment
                explorer.showTableComment = explorerPrefs.showTableComment
                explorer.showSemanticLayer = explorerPrefs.showSemanticLayer
                applyExpandedNodeIds(explorer.tree, explorerPrefs.expandedNodeIds)
            },
            applyWorkspace: (workspacePrefs) => {
                config.value.workspace = {
                    ...workspacePrefs,
                    showConsoleResultPanel: false,
                }
                showConsoleResultPanel.value = false
                if (workspacePrefs.restoreSession && workspacePrefs.tabs.length) {
                    workspace.restoreSession(workspacePrefs.tabs, workspacePrefs.activeTabIndex)
                } else {
                    workspace.closeAllClosable()
                }
            },
            applyProfile: (profile) => {
                layout.profileName = profile.name
                layout.profileEmail = profile.email
            },
            applyShortcuts: (shortcuts) => shortcutSettings.applyPreferences(shortcuts),
            applySqlEditorShortcutsShared: (shortcuts) => sqlEditorShortcuts.applyShared(shortcuts),
            applySqlEditorShortcuts: (shortcuts) => sqlEditorShortcuts.applyPersonal(shortcuts),
        })

        syncing = false
        persistNow()
        aiApi.syncPreferences(config.value.ai ?? DEFAULT_AI_PREFERENCES)
    }

    applyFullConfig(config.value)

    aiApi.syncPreferences(config.value.ai ?? DEFAULT_AI_PREFERENCES)

    setupElectronWindowSync({
        getWindow: () => config.value.window,
        onWindowChange: (window: WindowPreferences) => {
            config.value.window = window
            persistSoon()
        },
        applyInitial: (window) => {
            config.value.window = window
        },
    })

    watch(() => explorer.width, () => scheduleLayoutPersist())
    watch(() => layout.showTerminalPanel, () => scheduleLayoutPersist())
    watch(() => layout.terminalHeight, () => scheduleLayoutPersist())
    watch(() => layout.activeModule, () => scheduleLayoutPersist())
    watch(() => layout.activeShortcutPanel, () => scheduleLayoutPersist())
    watch(() => explorer.selectedNodeId, () => scheduleExplorerPersist())
    watch(() => explorer.searchQuery, () => scheduleExplorerPersist())
    watch(() => explorer.showColumnComment, () => scheduleExplorerPersist())
    watch(() => explorer.showTableComment, () => scheduleExplorerPersist())
    watch(() => explorer.showSemanticLayer, () => scheduleExplorerPersist())
    watch(() => explorer.treeVersion, () => persistHeavySoon())
    watch(() => workspace.tabs, () => persistHeavySoon(), {deep: true})
    watch(() => workspace.activeTabId, () => persistSoon())
    watch(() => theme.appearance, () => persistSoon())
    watch(() => theme.backgroundTone, () => persistSoon())
    watch(() => theme.primaryTone, () => persistSoon())
    watch(() => theme.uiSkin, () => persistSoon())
    watch(() => editor.settings, () => persistSoon(), {deep: true})
    watch(currentLocale, () => persistSoon())
    watch(() => layout.profileName, () => scheduleProfilePersist())
    watch(() => layout.profileEmail, () => scheduleProfilePersist())
    watch(() => shortcutSettings.bindings, () => persistSoon(), {deep: true})
    watch(() => sqlEditorShortcuts.sharedSettings, () => persistSoon(), {deep: true})
    watch(() => sqlEditorShortcuts.personalSettings, () => persistSoon(), {deep: true})

    if (typeof window !== 'undefined') {
        const flushOnExit = () => flushHeavyPersist()
        window.addEventListener('pagehide', flushOnExit)
        window.addEventListener('beforeunload', flushOnExit)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flushOnExit()
        })
    }

    const showSideRailStrip = computed(() => preferences.value.showSideRailStrip !== false)
    const showShortcutRailStrip = computed(() => preferences.value.showShortcutRailStrip !== false)

    function setShowSideRailStrip(visible: boolean) {
        applyLayoutState({...snapshotLayout(), showSideRailStrip: visible})
    }

    function setShowShortcutRailStrip(visible: boolean) {
        applyLayoutState({...snapshotLayout(), showShortcutRailStrip: visible})
        if (!visible) {
            layout.activeShortcutPanel = null
            layout.showNotificationDrawer = false
        }
    }

    const shortcutPanelWidth = computed(() => preferences.value.shortcutPanelWidth)
    const shortcutPanelMaxHeight = computed(() => preferences.value.shortcutPanelMaxHeight)
    const consoleEditorHeight = computed(() => config.value.workspace?.consoleEditorHeight ?? 400)

    function patchWorkspacePreferences(
        patch: Partial<NonNullable<AppConfigFile['workspace']>>,
    ) {
        config.value = {
            ...config.value,
            workspace: {
                ...(config.value.workspace ?? {
                    restoreSession: true,
                    tabs: [],
                    activeTabIndex: 0,
                    consoleEditorHeight: 400,
                    showConsoleResultPanel: false,
                }),
                ...patch,
                // 不持久化展开态；磁盘侧始终保持收起
                showConsoleResultPanel: false,
            },
        }
        persistSoon()
    }

    function setConsoleEditorHeight(height: number) {
        patchWorkspacePreferences({consoleEditorHeight: height})
    }

    function setShowConsoleResultPanel(visible: boolean) {
        showConsoleResultPanel.value = visible
    }

    function setShortcutPanelWidth(width: number) {
        const next = {...snapshotLayout(), shortcutPanelWidth: width}
        config.value = {...config.value, layout: next}
        persistSoon()
    }

    function snapshotLayout(): LayoutPreferences {
        return JSON.parse(JSON.stringify(preferences.value)) as LayoutPreferences
    }

    function isSideRailVisible(id: SideRailItemId) {
        const feature = sideRailFeatureKey(id)
        if (feature && !canAccessFeature(feature)) return false
        return isSideRailItemVisible(preferences.value, id)
    }

    /** 开发者工具入口（侧栏 Dev + Hero/命令面板/设置联动） */
    function isPluginDevToolsVisible() {
        return isSideRailVisible('pluginDev')
    }

    function isShortcutAccessible(
        id: ShortcutPanel,
        layoutPrefs: LayoutPreferences = preferences.value,
    ): boolean {
        if (!canAccessFeature(shortcutFeatureKey(id))) return false
        if (!isShortcutRailItemVisible(layoutPrefs, id)) return false
        return isShortcutPanelEnabled(id, isPluginEnabledFromConfig)
    }

    function isShortcutVisible(id: ShortcutPanel) {
        return isShortcutAccessible(id)
    }

    const hasShortcutRailItems = computed(() =>
        SHORTCUT_RAIL_NAV_DEFS.some((item) => isShortcutAccessible(item.id)),
    )
    const showShortcutRail = computed(
        () => showShortcutRailStrip.value && hasShortcutRailItems.value,
    )

    watch(showShortcutRail, (visible) => {
        if (visible) return
        if (layout.activeShortcutPanel) {
            layout.activeShortcutPanel = null
        }
    })

    function canOpenSettingsSection(section: SettingsSection): boolean {
        if (!canAccessFeature(FeaturePermission.NavSettings)) return false
        return canAccessFeature(settingsSectionFeatureKey(section))
    }

    function setSideRailVisible(id: SideRailItemId, visible: boolean) {
        const next = snapshotLayout()
        next.sideRailVisibility[id] = visible
        applyLayoutState(next)

        if (!visible) {
            if (id === 'terminal') layout.closeTerminalPanel()
            if (id === 'notify') layout.showNotificationDrawer = false
            if (
                (id === 'database' || id === 'dashboard' || id === 'ai' || id === 'plugin' || id === 'pluginDev' || id === 'connectorMarket')
                && layout.activeModule === id
            ) {
                layout.setModule(pickAccessibleModule(next))
            }
        }
    }

    function setShortcutVisible(id: ShortcutPanel, visible: boolean) {
        const next = snapshotLayout()
        next.shortcutRailVisibility[id] = visible
        applyLayoutState(next)
        if (!visible && layout.activeShortcutPanel === id) {
            layout.activeShortcutPanel = null
        }
        if (!hasShortcutRailItems.value && layout.activeShortcutPanel) {
            layout.activeShortcutPanel = null
        }
    }

    function setShowExplorerPanel(visible: boolean) {
        applyLayoutState({...snapshotLayout(), showExplorerPanel: visible})
    }

    function importConfigText(text: string): boolean {
        const file = parseAppConfigFile(text)
        if (!file) return false
        if (file.theme) theme.importPreferences(file.theme)
        const merged: AppConfigFile = {
            ...file,
            plugins: mergePluginsOnAppConfigImport(config.value.plugins, file.plugins),
        }
        applyFullConfig(merged)
        usePluginStore().syncAllRuntimeGates()
        return true
    }

    function exportConfig() {
        exportAppConfigDownload(captureConfig())
    }

    function resetLayoutDefaults() {
        applyFullConfig(createDefaultAppConfig())
    }

    /** 一键专注：隐藏侧栏与结果面板，保留资源树便于查表写 SQL */
    function applyFocusMode() {
        const layout = useLayoutStore()
        applyLayoutState({
            ...snapshotLayout(),
            showSideRailStrip: false,
            showShortcutRailStrip: false,
            showExplorerPanel: true,
        })
        setShowConsoleResultPanel(false)
        layout.closeTerminalPanel()
        layout.showNotificationDrawer = false
        layout.activeShortcutPanel = null
    }

    async function syncFromServer() {
        if (readGuestFlag()) {
            applyFullConfig(createDefaultAppConfig())
            await syncSqlEditorLayersFromServer()
            const updaterPrefs = await syncUpdatePreferencesFromServer()
            useUpdateSettingsStore().$patch({preferences: updaterPrefs})
            return
        }

        const remote = await fetchAppConfigFromServer()
        if (remote) {
            applyFullConfig(remote)
        } else if (!readGuestFlag()) {
            await pushLocalAppConfigToServer(captureConfig())
        } else {
            applyFullConfig(readAppConfig())
        }
        await syncSqlEditorLayersFromServer()
        const updaterPrefs = await syncUpdatePreferencesFromServer()
        useUpdateSettingsStore().$patch({preferences: updaterPrefs})
    }

    function reloadForCurrentScope(next = readAppConfig()) {
        applyFullConfig(next)
    }

    const sideRailItems = computed(() =>
        SIDE_RAIL_NAV_DEFS.map((item) => ({
            ...item,
            visible: isSideRailItemVisible(preferences.value, item.id),
        })),
    )

    const shortcutRailItems = computed(() =>
        SHORTCUT_RAIL_NAV_DEFS.map((item) => ({
            ...item,
            visible: isShortcutAccessible(item.id),
        })),
    )

    function setSkipSqlConfirmation(value: boolean) {
        patchAiPreferences({skipSqlConfirmation: value})
    }

    function setDisabledAnalysisSteps(steps: AiPreferences['disabledAnalysisSteps']) {
        patchAiPreferences({disabledAnalysisSteps: steps ?? []})
    }

    function setAnalysisMode(mode: AiPreferences['analysisMode']) {
        patchAiPreferences({analysisMode: mode ?? 'smart'})
    }

    function setAnalysisStepLlmId(step: AiAnalysisLlmRouteStep, profileId: string) {
        const routes = {...(aiPreferences.value.analysisStepLlmIds ?? {})}
        const defaultId = aiPreferences.value.workbenchLlmId || aiPreferences.value.defaultLlmId
        if (!profileId || profileId === defaultId) {
            delete routes[step]
        } else if (aiPreferences.value.llmProfiles.some((profile) => profile.id === profileId)) {
            routes[step] = profileId
        } else {
            return
        }
        patchAiPreferences({
            analysisStepLlmIds: Object.keys(routes).length ? routes : undefined,
        })
    }

    return {
        config,
        preferences,
        aiPreferences,
        connectionHealthPreferences,
        patchConnectionHealth,
        dangerousSqlPreferences,
        patchDangerousSql,
        dashboardPreferences,
        patchDashboardPreferences,
        resetDashboardPreferences,
        defaultLlmProfile,
        workbenchLlmProfile,
        defaultEmbeddingProfile,
        showExplorerPanel: computed(() => preferences.value.showExplorerPanel),
        showSideRailStrip,
        showShortcutRailStrip,
        hasShortcutRailItems,
        showShortcutRail,
        shortcutPanelWidth,
        shortcutPanelMaxHeight,
        consoleEditorHeight,
        showConsoleResultPanel,
        sideRailItems,
        shortcutRailItems,
        isSideRailVisible,
        isPluginDevToolsVisible,
        isShortcutVisible,
        canOpenSettingsSection,
        setSideRailVisible,
        setShortcutVisible,
        setShowExplorerPanel,
        setShowSideRailStrip,
        setShowShortcutRailStrip,
        setConsoleEditorHeight,
        setShowConsoleResultPanel,
        setShortcutPanelWidth,
        setAiSideActivePanel,
        addLlmProfile,
        updateLlmProfile,
        addEmbeddingProfile,
        updateEmbeddingProfile,
        insertLlmProfile,
        insertEmbeddingProfile,
        patchRagPreferences,
        persistConfigNow,
        persistConfigNowAsync,
        removeEmbeddingProfile,
        setDefaultEmbeddingProfile,
        removeLlmProfile,
        setDefaultLlmProfile,
        setWorkbenchLlmProfile,
        setSkipSqlConfirmation,
        setDisabledAnalysisSteps,
        setAnalysisMode,
        setAnalysisStepLlmId,
        patchPlugins,
        exportConfig,
        importConfigText,
        resetLayoutDefaults,
        applyFocusMode,
        syncFromServer,
        reloadForCurrentScope,
        pickAccessibleModule,
    }
})
