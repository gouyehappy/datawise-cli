import {existsSync} from 'node:fs'
import {ipcMain, shell} from 'electron'
import {resolveRuntimeConfigDir} from './backend-service'
import {resolveRuntimeLogPath, RUNTIME_LOG_FILE} from './runtime-log'

export interface OpenRuntimeLogResult {
    ok: boolean
    path?: string
    error?: 'missing' | 'open_failed'
}

export function registerRuntimeLogIpc() {
    ipcMain.handle('logs:openRuntime', async (): Promise<OpenRuntimeLogResult> => {
        const configDir = resolveRuntimeConfigDir()
        const logPath = resolveRuntimeLogPath(configDir)
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

export {RUNTIME_LOG_FILE}
