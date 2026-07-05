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

export const useLayoutStore = defineStore('layout', () => {
    const toast = useToastStore()
    const shortcutPanel = useShortcutPanelStore()
    const teamStore = useTeamStore()

    const settingsSection = ref<SettingsSection>('basic')
    const settingsScrollAnchor = ref<string | null>(null)
    const activeModule = ref<NavModule>('dashboard')
    const activeShortcutPanel = ref<ShortcutPanel | null>(null)
    const showTerminalPanel = ref(false)
    const terminalHeight = ref(240)
    const showNotificationDrawer = ref(false)
    const showProfileMenu = ref(false)

    const profileName = ref(t('profile.defaultName'))
    const profileEmail = ref('user@datawise.local')

    const isDatabaseModule = computed(() => activeModule.value === 'database')

    const isWorkbenchModule = computed(() =>
        ['database', 'ai', 'dashboard', 'plugin', 'pluginDev', 'team', 'settings'].includes(activeModule.value),
    )

    function setModule(module: NavModule) {
        if (module === 'profile') {
            openSettingsModule('profile')
            return
        }
        showProfileMenu.value = false
        activeModule.value = module
    }

    function openSettingsModule(section: SettingsSection = 'basic', anchor?: string) {
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
    }
})

/** 便捷组合：壳层 + 通知未读数（侧栏角标等） */
export function useLayoutShell() {
    const layout = useLayoutStore()
    const notifications = useNotificationStore()
    return {layout, notifications}
}
