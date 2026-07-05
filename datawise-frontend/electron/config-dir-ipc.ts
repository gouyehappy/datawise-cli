import {app, dialog, ipcMain} from 'electron'
import {readDesktopPreferences, writeDesktopPreferences} from './desktop-preferences'
import {
    bootstrapConfigDirectory,
    resolveConfiguredConfigPath,
    resolveDefaultConfigDir,
    resolveRuntimeConfigDir,
    stopBundledBackend,
} from './backend-service'
import {
    buildWorkspaceList,
    normalizeWorkspacePath,
    prepareNewWorkspaceDirectory,
    removeRecentWorkspace,
    touchRecentWorkspace,
    type CreateWorkspaceResult,
    type WorkspaceListEntry,
} from './workspace-preferences'

export interface ConfigDirSettings {
    configured: string | null
    resolved: string
    defaultPath: string
    canChange: boolean
    recentWorkspaces: WorkspaceListEntry[]
}

function switchWorkspaceAndRestart(configured: string | null | undefined): void {
    const trimmed = configured?.trim() || ''
    writeDesktopPreferences({configDir: trimmed || undefined})
    const targetDir = resolveRuntimeConfigDir()
    touchRecentWorkspace(targetDir)
    bootstrapConfigDirectory(targetDir)
    stopBundledBackend()
    app.relaunch()
    app.exit(0)
}

export function registerConfigDirIpc() {
    ipcMain.handle('config:getSettings', (): ConfigDirSettings => {
        const prefs = readDesktopPreferences()
        const configured = prefs.configDir?.trim() || null
        const resolved = resolveRuntimeConfigDir()
        const defaultPath = resolveDefaultConfigDir()
        return {
            configured,
            resolved,
            defaultPath,
            canChange: true,
            recentWorkspaces: buildWorkspaceList(resolved, defaultPath),
        }
    })

    ipcMain.handle('config:pickDirectory', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory'],
            defaultPath: resolveRuntimeConfigDir(),
        })
        if (result.canceled || !result.filePaths[0]) return null
        return result.filePaths[0]
    })

    ipcMain.handle('config:applyAndRestart', async (_event, configDir: string | null) => {
        switchWorkspaceAndRestart(configDir)
        return true
    })

    ipcMain.handle('config:switchWorkspace', async (_event, resolvedPath: string | null) => {
        const defaultPath = resolveDefaultConfigDir()
        if (!resolvedPath?.trim()) {
            switchWorkspaceAndRestart(null)
            return true
        }
        const normalized = normalizeWorkspacePath(resolvedPath)
        const configured = normalized === normalizeWorkspacePath(defaultPath)
            ? null
            : normalized
        switchWorkspaceAndRestart(configured)
        return true
    })

    ipcMain.handle('config:removeRecentWorkspace', async (_event, resolvedPath: string) => {
        removeRecentWorkspace(resolvedPath)
        return buildWorkspaceList(resolveRuntimeConfigDir(), resolveDefaultConfigDir())
    })

    ipcMain.handle('config:createWorkspace', async (_event, name: string): Promise<CreateWorkspaceResult> => {
        return prepareNewWorkspaceDirectory(String(name ?? ''))
    })

    ipcMain.handle('config:resolvePath', (_event, configured: string) => {
        return resolveConfiguredConfigPath(configured)
    })
}
