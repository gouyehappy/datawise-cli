/// <reference types="vite/client" />

declare module '*.json' {
    const value: unknown
    export default value
}

import type {WindowPreferences} from '@/shared/config/app-config.types'
import type {DeepLinkOpenPayload} from '@/shared/deep-link/deep-link.types'
import type {NativeTerminalBridge} from '@/features/terminal/services/native-terminal.types'
import type {PluginHookHandlers} from '@/features/plugin/types/plugin-hook.types'

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

declare global {
    interface Window {
        /** Electron preload 注入的只读 IPC 桥；勿直接覆盖 */
        __datawiseDesktopBridge?: Omit<
            NonNullable<Window['datawise']>,
            'registerPluginHooks' | 'unregisterPluginHooks'
        >
        datawise?: {
            platform: string
            apiBaseUrl?: string
            window?: {
                getState: () => Promise<WindowPreferences | null>
                setState: (state: WindowPreferences) => Promise<boolean>
                onStateChange: (callback: (state: WindowPreferences) => void) => () => void
            }
            terminal?: NativeTerminalBridge
            chrome?: {
                minimize: () => Promise<boolean>
                toggleMaximize: () => Promise<boolean>
                close: () => Promise<boolean>
                isMaximized: () => Promise<boolean>
                onMaximizeChange: (callback: (maximized: boolean) => void) => () => void
            }
            updater?: {
                checkForUpdates: () => Promise<{
                    currentVersion: string
                    latestVersion: string
                    hasUpdate: boolean
                }>
            }
            config?: {
                getSettings: () => Promise<{
                    configured: string | null
                    resolved: string
                    defaultPath: string
                    canChange: boolean
                    recentWorkspaces: Array<{
                        path: string
                        active: boolean
                        isDefault: boolean
                    }>
                }>
                pickDirectory: () => Promise<string | null>
                applyAndRestart: (configDir: string | null) => Promise<boolean>
                switchWorkspace: (resolvedPath: string | null) => Promise<boolean>
                removeRecentWorkspace: (resolvedPath: string) => Promise<Array<{
                    path: string
                    active: boolean
                    isDefault: boolean
                }>>
                createWorkspace: (name: string) => Promise<{
                    ok: true
                    path: string
                } | {
                    ok: false
                    error: 'invalid' | 'exists'
                }>
                resolvePath: (configured: string) => Promise<string>
            }
            deepLink?: {
                flushPending: () => Promise<DeepLinkOpenPayload | null>
                onOpen: (callback: (payload: DeepLinkOpenPayload) => void) => () => void
            }
            logs?: {
                openRuntime: () => Promise<{
                    ok: boolean
                    path?: string
                    error?: 'missing' | 'open_failed'
                }>
            }
            registerPluginHooks?: (pluginId: string, handlers: PluginHookHandlers) => void
            unregisterPluginHooks?: (pluginId: string) => void
        }
    }
}

export {}
