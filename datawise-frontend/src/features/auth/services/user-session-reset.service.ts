import {useAuthStore} from '@/features/auth/stores/auth-store'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useAiChatStore} from '@/features/ai/stores/ai-chat'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useNotificationStore} from '@/features/layout/stores/notification-store'
import {useShortcutPanelStore} from '@/features/layout/stores/shortcut-panel-store'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {cancelDeferredConfigServerWrites} from '@/shared/config/app-config.service'
import {setServerConfigSyncEnabled} from '@/shared/config/config-server-sync'
import {setAppConfigStorageScope} from '@/shared/config/app-config-storage-scope'
import {createDefaultAppConfig} from '@/shared/config/app-config.defaults'
import {readUserId} from '@/shared/auth/session'
import {syncAiPreferences} from '@/api'

/** 登录/退出/切换用户后重载 Explorer、配置与工作区状态。 */
export async function resetUserScopedState(): Promise<void> {
    cancelDeferredConfigServerWrites()
    setServerConfigSyncEnabled(false)

    try {
        const auth = useAuthStore()
        setAppConfigStorageScope({
            userId: auth.user?.userId ?? readUserId(),
            userName: auth.user?.userName,
            isGuest: auth.isGuest,
            tenantId: auth.tenantId,
        })

        const explorer = useExplorerStore()
        const appConfig = useAppConfigStore()
        const workspace = useWorkspaceStore()

        const configTask = auth.isGuest
            ? Promise.resolve(appConfig.reloadForCurrentScope(createDefaultAppConfig()))
            : appConfig.syncFromServer()
        await Promise.all([explorer.refreshTree(), configTask])

        workspace.closeAllClosable()
        useAiChatStore().reloadForCurrentScope()
        syncAiPreferences(appConfig.aiPreferences)
        await useShortcutPanelStore().load()
        await useNotificationStore().load()
    } finally {
        setServerConfigSyncEnabled(true)
    }
}
