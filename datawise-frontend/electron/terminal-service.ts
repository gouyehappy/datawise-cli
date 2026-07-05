import {ipcMain, type WebContents} from 'electron'
import * as pty from 'node-pty'

interface TerminalSession {
    process: pty.IPty
    webContents: WebContents
}

const sessions = new Map<string, TerminalSession>()

const SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/i

function isValidSessionId(sessionId: unknown): sessionId is string {
    return typeof sessionId === 'string' && SESSION_ID_PATTERN.test(sessionId)
}

function resolveShell(): string {
    if (process.platform === 'win32') {
        return process.env.DW_SHELL || 'powershell.exe'
    }
    return process.env.SHELL || '/bin/bash'
}

function resolveCwd(): string {
    return process.env.HOME || process.env.USERPROFILE || process.cwd()
}

function outputChannel(sessionId: string) {
    return `terminal:output:${sessionId}`
}

function exitChannel(sessionId: string) {
    return `terminal:exit:${sessionId}`
}

function disposeSession(sessionId: string) {
    const session = sessions.get(sessionId)
    if (!session) return
    try {
        session.process.kill()
    } catch {
        /* already exited */
    }
    sessions.delete(sessionId)
}

export function disposeTerminalSessionsForWebContents(webContents: WebContents) {
    for (const [sessionId, session] of sessions.entries()) {
        if (session.webContents === webContents) {
            disposeSession(sessionId)
        }
    }
}

export function registerTerminalIpc() {
    ipcMain.handle(
        'terminal:create',
        (event, sessionId: string, opts?: { cols?: number; rows?: number }) => {
            if (!isValidSessionId(sessionId) || sessions.has(sessionId)) {
                return {ok: false as const, error: 'invalid-session'}
            }

            const shell = resolveShell()
            const cwd = resolveCwd()
            const cols = Math.max(2, opts?.cols ?? 80)
            const rows = Math.max(2, opts?.rows ?? 24)

            const shellProcess = pty.spawn(shell, [], {
                name: 'xterm-256color',
                cols,
                rows,
                cwd,
                env: process.env as Record<string, string>,
            })

            const webContents = event.sender
            shellProcess.onData((data) => {
                if (!webContents.isDestroyed()) {
                    webContents.send(outputChannel(sessionId), data)
                }
            })
            shellProcess.onExit(({exitCode}) => {
                if (!webContents.isDestroyed()) {
                    webContents.send(exitChannel(sessionId), exitCode)
                }
                sessions.delete(sessionId)
            })

            sessions.set(sessionId, {process: shellProcess, webContents})
            return {ok: true as const, shell, cwd}
        },
    )

    ipcMain.handle('terminal:write', (_event, sessionId: string, data: string) => {
        if (!isValidSessionId(sessionId)) return false
        const session = sessions.get(sessionId)
        if (!session || typeof data !== 'string') return false
        session.process.write(data)
        return true
    })

    ipcMain.handle(
        'terminal:resize',
        (_event, sessionId: string, cols: number, rows: number) => {
            if (!isValidSessionId(sessionId)) return false
            const session = sessions.get(sessionId)
            if (!session) return false
            session.process.resize(
                Math.max(2, cols),
                Math.max(2, rows),
            )
            return true
        },
    )

    ipcMain.handle('terminal:destroy', (_event, sessionId: string) => {
        if (!isValidSessionId(sessionId)) return false
        disposeSession(sessionId)
        return true
    })
}

export function disposeAllTerminalSessions() {
    for (const sessionId of [...sessions.keys()]) {
        disposeSession(sessionId)
    }
}
