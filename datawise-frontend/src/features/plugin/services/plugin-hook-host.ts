import {
    registerPluginHooks,
    unregisterPluginHooks,
} from '@/features/plugin/services/plugin-hook.service'
import {readDesktopBridge} from '@/features/layout/services/desktop-bridge'
import type {PluginHookHandlers} from '@/features/plugin/types/plugin-hook.types'

export function installPluginHookHost(): void {
    if (typeof window === 'undefined') return

    const hooks = {
        registerPluginHooks: (pluginId: string, handlers: PluginHookHandlers) => {
            registerPluginHooks(pluginId, handlers)
        },
        unregisterPluginHooks: (pluginId: string) => {
            unregisterPluginHooks(pluginId)
        },
    }

    const bridge = readDesktopBridge()
    if (bridge) {
        // Preload 经 contextBridge 暴露的对象在页面里只读，不能整体赋值覆盖。
        window.datawise = {...bridge, ...hooks}
        return
    }

    if (!window.datawise) {
        window.datawise = {
            platform: 'web',
            ...hooks,
        }
    }
}
