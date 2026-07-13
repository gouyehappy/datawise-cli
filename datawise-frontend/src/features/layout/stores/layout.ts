/**
 * Layout 壳层状态：导航模块、面板可见性、用户资料
 *
 * 领域数据已拆至独立 store：
 * - theme-store / notification-store / team-store / plugin-store / shortcut-panel-store / toast-store
 */
import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import type {NavModule, SettingsSection, ShortcutPanel} from '@/core/types'
import {t} from '@/i18n'
import {useNotificationStore} from '@/features/layout/stores/notification-store'
import {useShortcutPanelStore} from '@/features/layout/stores/shortcut-panel-store'
import {useToastStore} from '@/features/layout/stores/toast-store'
import {useTeamStore} from '@/features/team/stores/team-store'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {canAccessFeature, sideRailFeatureKey} from '@/features/auth/services/feature-permission.service'
import {FeaturePermission} from '@/features/auth/types/feature-permission.types'
import type {SideRailItemId} from '@/features/layout/constants/side-rail-nav'

/** 系统首页：工作台（database） */
const HOME_NAV_MODULE: NavModule = 'database'

export const useLayoutStore = defineStore('layout', () => {
    const toast = useToastStore()
    const shortcutPanel = useShortcutPanelStore()
    const teamStore = useTeamStore()

    const settingsSection = ref<SettingsSection>('basic')
    const settingsScrollAnchor = ref<string | null>(null)
    const activeModule = ref<NavModule>('database')
    const activeShortcutPanel = ref<ShortcutPanel | null>(null)
    const showTerminalPanel = ref(false)
    const terminalHeight = ref(240)
    const showNotificationDrawer = ref(false)
    const showProfileMenu = ref(false)

    const profileName = ref(t('profile.defaultName'))
    const profileEmail = ref('user@datawise.local')

    const isDatabaseModule = computed(() => activeModule.value === 'database')

    const isWorkbenchModule = computed(() =>
        ['database', 'ai', 'dashboard', 'plugin', 'pluginDev', 'connectorMarket', 'team', 'settings'].includes(activeModule.value),
    )

    function canAccessNavModule(module: NavModule): boolean {
        if (module === 'settings') return canAccessFeature(FeaturePermission.NavSettings)
        if (module === 'team') return canAccessFeature(FeaturePermission.NavTeam)
        if (module === 'profile') return canAccessFeature(FeaturePermission.SettingsProfile)
        const sideRailId = module as SideRailItemId
        const feature = sideRailFeatureKey(sideRailId)
        return feature ? canAccessFeature(feature) : true
    }

    function setModule(module: NavModule) {
        if (module === 'profile') {
            openSettingsModule('profile')
            return
        }
        showProfileMenu.value = false
        activeModule.value = module
    }

    function openSettingsModule(section: SettingsSection = 'basic', anchor?: string) {
        const appConfig = useAppConfigStore()
        if (!appConfig.canOpenSettingsSection(section)) return
        showProfileMenu.value = false
        settingsSection.value = section
        settingsScrollAnchor.value = anchor ?? null
        activeModule.value = 'settings'
    }

    function clearSettingsScrollAnchor() {
        settingsScrollAnchor.value = null
    }

    function setSettingsSection(section: SettingsSection) {
        settingsSection.value = section
    }

    function toggleProfileMenu() {
        showProfileMenu.value = !showProfileMenu.value
    }

    function closeProfileMenu() {
        showProfileMenu.value = false
    }

    function openTeamModule() {
        if (!canAccessFeature(FeaturePermission.NavTeam)) return
        showProfileMenu.value = false
        activeModule.value = 'team'
    }

    function createTeam(name: string) {
        void teamStore.createTeam(name)
    }

    function joinTeam(code: string) {
        void teamStore.joinTeam(code)
    }

    function toggleShortcutPanel(panel: ShortcutPanel) {
        showNotificationDrawer.value = false
        activeShortcutPanel.value = activeShortcutPanel.value === panel ? null : panel
    }

    function toggleTerminalPanel() {
        showTerminalPanel.value = !showTerminalPanel.value
    }

    function closeTerminalPanel() {
        showTerminalPanel.value = false
    }

    function setTerminalHeight(height: number) {
        terminalHeight.value = Math.min(520, Math.max(160, height))
    }

    function showToast(message: string) {
        toast.show(message)
    }

    function showErrorToast(message: string) {
        toast.showError(message)
    }

    function globalRefresh() {
        // 刷新后树与工作区 UI 自行更新，无需 Toast
    }

    function startExport(fileName: string) {
        shortcutPanel.addExportTask(fileName, () => {
            toast.show(t('toast.exportComplete', {name: fileName}))
        })
        activeShortcutPanel.value = 'export'
    }

    /**
     * 权限变更后校正当前模块（仅在 auth 会话就绪后调用，勿在 app-config store 初始化链路中调用）。
     */
    function ensureAccessibleModule() {
        const appConfig = useAppConfigStore()

        if (activeModule.value === 'settings') {
            if (appConfig.canOpenSettingsSection(settingsSection.value)) return
        } else if (activeModule.value === 'team' && canAccessNavModule('team')) {
            return
        } else if (canAccessNavModule(activeModule.value)) {
            return
        }

        activeModule.value = appConfig.pickAccessibleModule()
        if (!canAccessNavModule(activeModule.value)) {
            activeModule.value = HOME_NAV_MODULE
        }
    }

    function updateProfile(name: string, email: string) {
        profileName.value = name
        profileEmail.value = email
        toast.show(t('toast.profileUpdated'))
    }

    return {
        settingsSection,
        settingsScrollAnchor,
        activeModule,
        activeShortcutPanel,
        showTerminalPanel,
        terminalHeight,
        showNotificationDrawer,
        showProfileMenu,
        profileName,
        profileEmail,
        isDatabaseModule,
        isWorkbenchModule,
        canAccessNavModule,
        setModule,
        openSettingsModule,
        clearSettingsScrollAnchor,
        setSettingsSection,
        toggleProfileMenu,
        closeProfileMenu,
        openTeamModule,
        createTeam,
        joinTeam,
        toggleShortcutPanel,
        toggleTerminalPanel,
        closeTerminalPanel,
        setTerminalHeight,
        showToast,
        showErrorToast,
        globalRefresh,
        startExport,
        updateProfile,
        ensureAccessibleModule,
    }
})

/** 便捷组合：壳层 + 通知未读数（侧栏角标等） */
export function useLayoutShell() {
    const layout = useLayoutStore()
    const notifications = useNotificationStore()
    return {layout, notifications}
}
