/**
 * Electron 预加载脚本
 *
 * 经 contextBridge 注入的对象在页面里只读；完整 window.datawise 由
 * installPluginHookHost() 在渲染进程组装（含 plugin hooks）。
 */
import {contextBridge, ipcRenderer} from 'electron'
import ports from '../runtime-ports.json' with {type: 'json'}
import type {WindowPreferences} from '../src/shared/config/app-config.types'
import type {DeepLinkOpenPayload} from '../src/shared/deep-link/deep-link.types'
import type {NativeTerminalCreateResult} from '../src/features/terminal/services/native-terminal.types'

function resolveDesktopBackendPort(): number {
    try {
        if (ipcRenderer.sendSync('get-is-packaged') === true) {
            return ports.backendPackaged
        }
    } catch {
        // preload 早于主进程注册时回退开发端口
    }
    return ports.backend
}

const DEFAULT_DESKTOP_API_BASE = `http://127.0.0.1:${resolveDesktopBackendPort()}`

contextBridge.exposeInMainWorld('__datawiseDesktopBridge', {
    platform: process.platform,
    apiBaseUrl: process.env.DATAWISE_API_BASE_URL?.trim() || DEFAULT_DESKTOP_API_BASE,
    window: {
        getState: (): Promise<WindowPreferences | null> => ipcRenderer.invoke('window:getState'),
        setState: (state: WindowPreferences): Promise<boolean> => ipcRenderer.invoke('window:setState', state),
        onStateChange: (callback: (state: WindowPreferences) => void) => {
            const listener = (_event: Electron.IpcRendererEvent, state: WindowPreferences) => callback(state)
            ipcRenderer.on('window:state-changed', listener)
            return () => ipcRenderer.removeListener('window:state-changed', listener)
        },
    },
    terminal: {
        create: (
            sessionId: string,
            opts?: { cols?: number; rows?: number },
        ): Promise<NativeTerminalCreateResult> => ipcRenderer.invoke('terminal:create', sessionId, opts),
        write: (sessionId: string, data: string): Promise<boolean> =>
            ipcRenderer.invoke('terminal:write', sessionId, data),
        resize: (sessionId: string, cols: number, rows: number): Promise<boolean> =>
            ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
        destroy: (sessionId: string): Promise<boolean> =>
            ipcRenderer.invoke('terminal:destroy', sessionId),
        onOutput: (sessionId: string, callback: (data: string) => void) => {
            const channel = `terminal:output:${sessionId}`
            const listener = (_event: Electron.IpcRendererEvent, data: string) => callback(data)
            ipcRenderer.on(channel, listener)
            return () => ipcRenderer.removeListener(channel, listener)
        },
        onExit: (sessionId: string, callback: (exitCode: number) => void) => {
            const channel = `terminal:exit:${sessionId}`
            const listener = (_event: Electron.IpcRendererEvent, exitCode: number) => callback(exitCode)
            ipcRenderer.on(channel, listener)
            return () => ipcRenderer.removeListener(channel, listener)
        },
    },
    chrome: {
        minimize: (): Promise<boolean> => ipcRenderer.invoke('window:minimize'),
        toggleMaximize: (): Promise<boolean> => ipcRenderer.invoke('window:toggleMaximize'),
        close: (): Promise<boolean> => ipcRenderer.invoke('window:close'),
        isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
        onMaximizeChange: (callback: (maximized: boolean) => void) => {
            const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized)
            ipcRenderer.on('window:maximize-changed', listener)
            return () => ipcRenderer.removeListener('window:maximize-changed', listener)
        },
    },
    updater: {
        checkForUpdates: (): Promise<{
            currentVersion: string
            latestVersion: string
            hasUpdate: boolean
        }> => ipcRenderer.invoke('updater:checkForUpdates'),
    },
    config: {
        getSettings: (): Promise<{
            configured: string | null
            resolved: string
            defaultPath: string
            canChange: boolean
            recentWorkspaces: Array<{
                path: string
                active: boolean
                isDefault: boolean
            }>
        }> => ipcRenderer.invoke('config:getSettings'),
        pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('config:pickDirectory'),
        applyAndRestart: (configDir: string | null): Promise<boolean> =>
            ipcRenderer.invoke('config:applyAndRestart', configDir),
        switchWorkspace: (resolvedPath: string | null): Promise<boolean> =>
            ipcRenderer.invoke('config:switchWorkspace', resolvedPath),
        removeRecentWorkspace: (resolvedPath: string): Promise<Array<{
            path: string
            active: boolean
            isDefault: boolean
        }>> => ipcRenderer.invoke('config:removeRecentWorkspace', resolvedPath),
        createWorkspace: (name: string): Promise<{
            ok: true
            path: string
        } | {
            ok: false
            error: 'invalid' | 'exists'
        }> => ipcRenderer.invoke('config:createWorkspace', name),
        resolvePath: (configured: string): Promise<string> =>
            ipcRenderer.invoke('config:resolvePath', configured),
    },
    deepLink: {
        flushPending: (): Promise<DeepLinkOpenPayload | null> =>
            ipcRenderer.invoke('deep-link:flushPending'),
        onOpen: (callback: (payload: DeepLinkOpenPayload) => void) => {
            const listener = (_event: Electron.IpcRendererEvent, payload: DeepLinkOpenPayload) =>
                callback(payload)
            ipcRenderer.on('deep-link:open', listener)
            return () => ipcRenderer.removeListener('deep-link:open', listener)
        },
    },
    logs: {
        openRuntime: (): Promise<{
            ok: boolean
            path?: string
            error?: 'missing' | 'open_failed'
        }> => ipcRenderer.invoke('logs:openRuntime'),
    },
    backend: {
        getStartupState: (): Promise<{
            phase: string
            progress: number
        }> => ipcRenderer.invoke('backend:getStartupState'),
        onStartupProgress: (callback: (event: { phase: string; progress: number }) => void) => {
            const listener = (
                _event: Electron.IpcRendererEvent,
                payload: { phase: string; progress: number },
            ) => callback(payload)
            ipcRenderer.on('backend:startup-progress', listener)
            return () => ipcRenderer.removeListener('backend:startup-progress', listener)
        },
    },
    splash: {
        notifyReady: () => ipcRenderer.send('splash:ready'),
        notifyBarPainted: (progress: number) => ipcRenderer.send('splash:bar-painted', progress),
        waitBarComplete: (progress = 100): Promise<boolean> =>
            ipcRenderer.invoke('splash:waitBarComplete', progress),
        reportProgress: (payload: { progress: number; status: string }) =>
            ipcRenderer.send('splash:progress', payload),
        onProgress: (callback: (payload: { progress: number; status?: string }) => void) => {
            const listener = (
                _event: Electron.IpcRendererEvent,
                payload: { progress: number; status?: string },
            ) => callback(payload)
            ipcRenderer.on('splash:progress', listener)
            return () => ipcRenderer.removeListener('splash:progress', listener)
        },
        getMeta: (): { version: string; tagline: string; isPackaged: boolean } => ipcRenderer.sendSync('splash:getMeta'),
    },
})
