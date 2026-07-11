/**
 * 应用入口（整个前端从这里开始）
 *
 * 启动顺序：
 *   index.html 内联脚本 → theme-init（主题变量）→ global.css → Vue 挂载
 */
import {installPluginHookHost} from './features/plugin/services/plugin-hook-host'

installPluginHookHost()

import './theme-init'
import './styles/global.css'

import {createApp} from 'vue'
import {createPinia, setActivePinia} from 'pinia'
import App from './app/App.vue'
import {i18n} from './i18n'
import {setupExplorerContextMenus} from './features/explorer/setup-context-menus'
import {registerSqlEditorApp} from '@/features/workspace/services/ensure-sql-editor-plugin'

import {registerApiErrorNotifier} from '@/shared/api/http/api-error-notifier'
import {HTTP_NOT_READY} from '@/shared/api/http/request'
import {useToastStore} from '@/features/layout/stores/toast-store'
import {shouldSuppressApiErrorToast} from '@/features/layout/services/api-error-toast-policy.service'
import {markBackendOffline} from '@/features/layout/services/backend-health.service'
import {installUnauthorizedSessionRecovery} from '@/features/auth/services/auth-session-recovery.service'

registerApiErrorNotifier((message, error) => {
    if (shouldSuppressApiErrorToast(error)) return
    if (message === HTTP_NOT_READY || message.startsWith('HTTP API request failed')) {
        markBackendOffline()
    }
    useToastStore().showError(message)
})

setupExplorerContextMenus()

const pinia = createPinia()
setActivePinia(pinia)
installUnauthorizedSessionRecovery()

const app = createApp(App).use(pinia).use(i18n)
registerSqlEditorApp(app)
app.mount('#app')
