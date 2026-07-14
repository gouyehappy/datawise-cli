import type {
    NativeTerminalBridge,
    NativeTerminalCreateResult,
} from '@/features/terminal/services/native-terminal.types'
import {readApiBaseUrl} from '@/shared/api/mode'
import {backendDevBaseUrl} from '@/shared/config/runtime-ports'

type OutputHandler = (data: string) => void
type ExitHandler = (exitCode: number) => void

interface TerminalWsMessage {
    type: string
    sessionId?: string
    data?: string
    ok?: boolean
    error?: string
    code?: string | number
    message?: string
}

/** Keep the browser ↔ backend WebSocket alive across idle proxies/NATs. */
const WS_PING_INTERVAL_MS = 20_000
/** Soft ceiling for WS open + backend SSH session create (covers JSch connect timeout). */
const CREATE_TIMEOUT_MS = 25_000

function resolveWebSocketUrl(path: string, connectionId: string): string {
    const sessionId = localStorage.getItem('dw-cli-session-id')
    const params = new URLSearchParams()
    if (sessionId) params.set('dwSession', sessionId)
    params.set('connectionId', connectionId)
    const query = `?${params.toString()}`
    const configured = readApiBaseUrl()
    if (configured) {
        const protocol = configured.startsWith('https://') ? 'wss://' : 'ws://'
        const host = configured.replace(/^https?:\/\//, '')
        return `${protocol}${host}${path}${query}`
    }
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        return `${protocol}//${window.location.host}${path}${query}`
    }
    return `${backendDevBaseUrl('127.0.0.1').replace(/^http/, 'ws')}${path}${query}`
}

export function createSshTerminalBridge(
    connectionId: string,
    path = '/ws/ssh-shell',
): NativeTerminalBridge & {isOpen: (sessionId: string) => boolean} {
    const sockets = new Map<string, WebSocket>()
    const outputHandlers = new Map<string, Set<OutputHandler>>()
    const exitHandlers = new Map<string, Set<ExitHandler>>()
    const outputBuffers = new Map<string, string[]>()
    const pingTimers = new Map<string, ReturnType<typeof setInterval>>()
    const intentionalClose = new Set<string>()

    function emitOutput(sessionId: string, data: string) {
        const handlers = outputHandlers.get(sessionId)
        if (!handlers?.size) {
            const buffer = outputBuffers.get(sessionId) ?? []
            buffer.push(data)
            outputBuffers.set(sessionId, buffer)
            return
        }
        for (const handler of handlers) {
            handler(data)
        }
    }

    function emitExit(sessionId: string, code: number) {
        for (const handler of exitHandlers.get(sessionId) ?? []) {
            handler(code)
        }
    }

    function send(socket: WebSocket, payload: Record<string, unknown>) {
        if (socket.readyState !== WebSocket.OPEN) return
        socket.send(JSON.stringify(payload))
    }

    function stopPing(sessionId: string) {
        const timer = pingTimers.get(sessionId)
        if (timer) {
            clearInterval(timer)
            pingTimers.delete(sessionId)
        }
    }

    function startPing(sessionId: string, socket: WebSocket) {
        stopPing(sessionId)
        pingTimers.set(
            sessionId,
            setInterval(() => {
                if (socket.readyState !== WebSocket.OPEN) {
                    stopPing(sessionId)
                    return
                }
                send(socket, {type: 'ping', sessionId})
            }, WS_PING_INTERVAL_MS),
        )
    }

    function ensureHandlers(sessionId: string) {
        if (!outputHandlers.has(sessionId)) outputHandlers.set(sessionId, new Set())
        if (!exitHandlers.has(sessionId)) exitHandlers.set(sessionId, new Set())
    }

    return {
        async create(sessionId, opts) {
            ensureHandlers(sessionId)
            intentionalClose.delete(sessionId)
            const socket = new WebSocket(resolveWebSocketUrl(path, connectionId))
            sockets.set(sessionId, socket)

            const result = await new Promise<NativeTerminalCreateResult>((resolve) => {
                let settled = false
                let timeoutId: ReturnType<typeof setTimeout> | null = null
                const settle = (value: NativeTerminalCreateResult) => {
                    if (settled) return
                    settled = true
                    if (timeoutId) {
                        clearTimeout(timeoutId)
                        timeoutId = null
                    }
                    resolve(value)
                }

                timeoutId = setTimeout(() => {
                    intentionalClose.add(sessionId)
                    try {
                        socket.close()
                    } catch {
                        // ignore
                    }
                    settle({
                        ok: false,
                        error: `SSH terminal timed out after ${Math.round(CREATE_TIMEOUT_MS / 1000)}s (WebSocket / shell create)`,
                    })
                }, CREATE_TIMEOUT_MS)

                socket.addEventListener('open', () => {
                    send(socket, {
                        type: 'create',
                        sessionId,
                        cols: opts?.cols ?? 80,
                        rows: opts?.rows ?? 24,
                    })
                })

                socket.addEventListener('message', (event) => {
                    let message: TerminalWsMessage
                    try {
                        message = JSON.parse(String(event.data)) as TerminalWsMessage
                    } catch {
                        return
                    }
                    if (message.sessionId !== sessionId) return

                    switch (message.type) {
                        case 'created':
                            if (message.ok === true) {
                                startPing(sessionId, socket)
                            }
                            settle({
                                ok: message.ok === true,
                                error: message.error,
                            })
                            break
                        case 'output':
                            if (message.data) emitOutput(sessionId, message.data)
                            break
                        case 'pong':
                            break
                        case 'exit':
                            stopPing(sessionId)
                            emitExit(sessionId, typeof message.code === 'number' ? message.code : 0)
                            break
                        case 'error':
                            if (message.code !== 'FORBIDDEN') break
                            // Before create settles: fail the handshake cleanly.
                            // After create: ignore — backend soft-denies pending/stale actions;
                            // hard-closing here caused the intermittent “连接失败 / WebSocket closed”.
                            if (!settled) {
                                intentionalClose.add(sessionId)
                                stopPing(sessionId)
                                try {
                                    socket.close()
                                } catch {
                                    // ignore
                                }
                                settle({
                                    ok: false,
                                    error: message.message ?? 'SSH terminal access denied',
                                })
                            }
                            break
                    }
                })

                socket.addEventListener('error', () => {
                    settle({ok: false, error: 'WebSocket connection failed'})
                })

                socket.addEventListener('close', () => {
                    stopPing(sessionId)
                    const wasIntentional = intentionalClose.has(sessionId)
                    intentionalClose.delete(sessionId)
                    sockets.delete(sessionId)
                    if (!wasIntentional) {
                        emitExit(sessionId, 0)
                    }
                    settle({ok: false, error: 'WebSocket closed'})
                })
            })

            return result
        },

        async write(sessionId, data) {
            const socket = sockets.get(sessionId)
            if (!socket || socket.readyState !== WebSocket.OPEN) return false
            send(socket, {type: 'write', sessionId, data})
            return true
        },

        async resize(sessionId, cols, rows) {
            const socket = sockets.get(sessionId)
            if (!socket || socket.readyState !== WebSocket.OPEN) return false
            send(socket, {type: 'resize', sessionId, cols, rows})
            return true
        },

        async destroy(sessionId) {
            const socket = sockets.get(sessionId)
            // Mark before close so the async 'close' event does not look like a drop.
            intentionalClose.add(sessionId)
            stopPing(sessionId)
            outputHandlers.delete(sessionId)
            exitHandlers.delete(sessionId)
            outputBuffers.delete(sessionId)
            sockets.delete(sessionId)
            if (socket) {
                send(socket, {type: 'destroy', sessionId})
                socket.close()
            } else {
                intentionalClose.delete(sessionId)
            }
            return true
        },

        isOpen(sessionId) {
            const socket = sockets.get(sessionId)
            return socket?.readyState === WebSocket.OPEN
        },

        onOutput(sessionId, callback) {
            ensureHandlers(sessionId)
            outputHandlers.get(sessionId)?.add(callback)
            const buffered = outputBuffers.get(sessionId)
            if (buffered?.length) {
                for (const chunk of buffered) {
                    callback(chunk)
                }
                outputBuffers.delete(sessionId)
            }
            return () => outputHandlers.get(sessionId)?.delete(callback)
        },

        onExit(sessionId, callback) {
            ensureHandlers(sessionId)
            exitHandlers.get(sessionId)?.add(callback)
            return () => exitHandlers.get(sessionId)?.delete(callback)
        },
    }
}
