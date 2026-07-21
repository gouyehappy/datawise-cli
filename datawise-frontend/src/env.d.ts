/// <reference types="vite/client" />

declare module '*.json' {
    const value: unknown
    export default value
}

declare module '*.svg?raw' {
    const content: string
    export default content
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
                    downloadReady?: boolean
                    downloading?: boolean
                    error?: string
                }>
                downloadUpdate: () => Promise<{
                    currentVersion: string
                    latestVersion: string
                    hasUpdate: boolean
                    downloadReady?: boolean
                    downloading?: boolean
                    error?: string
                }>
                quitAndInstall: () => Promise<boolean>
                setPreferences: (prefs: {
                    notifyOnUpdate: boolean
                    autoDownload: boolean
                }) => Promise<boolean>
                getStatus: () => Promise<{
                    currentVersion: string
                    latestVersion: string
                    hasUpdate: boolean
                    downloadReady?: boolean
                    downloading?: boolean
                    error?: string
                }>
                onStatus: (callback: (event: {
                    phase: 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available'
                    currentVersion: string
                    latestVersion: string
                    percent?: number
                    error?: string
                }) => void) => () => void
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
            backend?: {
                getStartupState: () => Promise<{
                    phase: string
                    progress: number
                }>
                onStartupProgress: (callback: (event: {
                    phase: string
                    progress: number
                }) => void) => () => void
            }
            splash?: {
                notifyReady: () => void
                notifyBarPainted: (progress: number) => void
                waitBarComplete: (progress?: number) => Promise<boolean>
                reportProgress: (payload: { progress: number; status: string }) => void
                onProgress: (callback: (payload: { progress: number; status?: string }) => void) => () => void
                getMeta: () => { version: string; tagline: string; isPackaged: boolean }
            }
            registerPluginHooks?: (pluginId: string, handlers: PluginHookHandlers) => void
            unregisterPluginHooks?: (pluginId: string) => void
        }
    }
}

export {}
