import {existsSync, mkdirSync} from 'node:fs'
import {join} from 'node:path'
import {ipcMain, shell} from 'electron'
import {resolveRuntimeConfigDir} from './backend-service'

export interface OpenRuntimeLogResult {
    ok: boolean
    path?: string
    error?: 'missing' | 'open_failed'
}

function resolveRuntimeLogPath(): string {
    const configDir = resolveRuntimeConfigDir()
    const logDir = join(configDir, 'logs')
    if (!existsSync(logDir)) {
        mkdirSync(logDir, {recursive: true})
    }
    return join(logDir, 'datawise.log')
}

export function registerRuntimeLogIpc() {
    ipcMain.handle('logs:openRuntime', async (): Promise<OpenRuntimeLogResult> => {
        const logPath = resolveRuntimeLogPath()
        if (!existsSync(logPath)) {
            return {ok: false, path: logPath, error: 'missing'}
        }
        const result = await shell.openPath(logPath)
        if (result) {
            return {ok: false, path: logPath, error: 'open_failed'}
        }
        return {ok: true, path: logPath}
    })
}
