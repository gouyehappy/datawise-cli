import type {
    NativeTerminalBridge,
    NativeTerminalCreateResult,
} from '@/features/terminal/services/native-terminal.types'
import {readApiBaseUrl} from '@/shared/api/mode'

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

function resolveWebSocketUrl(path: string): string {
    const sessionId = localStorage.getItem('dw-cli-session-id')
    const query = sessionId ? `?dwSession=${encodeURIComponent(sessionId)}` : ''
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
    return `ws://127.0.0.1:18421${path}${query}`
}

export function createWebSocketTerminalBridge(path = '/ws/terminal'): NativeTerminalBridge {
    const sockets = new Map<string, WebSocket>()
    const outputHandlers = new Map<string, Set<OutputHandler>>()
    const exitHandlers = new Map<string, Set<ExitHandler>>()

    function emitOutput(sessionId: string, data: string) {
        for (const handler of outputHandlers.get(sessionId) ?? []) {
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

    function ensureHandlers(sessionId: string) {
        if (!outputHandlers.has(sessionId)) outputHandlers.set(sessionId, new Set())
        if (!exitHandlers.has(sessionId)) exitHandlers.set(sessionId, new Set())
    }

    return {
        async create(sessionId, opts) {
            ensureHandlers(sessionId)
            const socket = new WebSocket(resolveWebSocketUrl(path))
            sockets.set(sessionId, socket)

            const result = await new Promise<NativeTerminalCreateResult>((resolve) => {
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
                            resolve({
                                ok: message.ok === true,
                                error: message.error,
                            })
                            break
                        case 'output':
                            if (message.data) emitOutput(sessionId, message.data)
                            break
                        case 'exit':
                            emitExit(sessionId, typeof message.code === 'number' ? message.code : 0)
                            break
                        case 'error':
                            if (message.code === 'FORBIDDEN') {
                                socket.close()
                                emitExit(sessionId, 1)
                            }
                            break
                    }
                })

                socket.addEventListener('error', () => {
                    resolve({ok: false, error: 'WebSocket connection failed'})
                })

                socket.addEventListener('close', () => {
                    emitExit(sessionId, 0)
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
            if (socket) {
                send(socket, {type: 'destroy', sessionId})
                socket.close()
                sockets.delete(sessionId)
            }
            outputHandlers.delete(sessionId)
            exitHandlers.delete(sessionId)
            return true
        },

        onOutput(sessionId, callback) {
            ensureHandlers(sessionId)
            outputHandlers.get(sessionId)?.add(callback)
            return () => outputHandlers.get(sessionId)?.delete(callback)
        },

        onExit(sessionId, callback) {
            ensureHandlers(sessionId)
            exitHandlers.get(sessionId)?.add(callback)
            return () => exitHandlers.get(sessionId)?.delete(callback)
        },
    }
}

let cachedBridge: NativeTerminalBridge | null | undefined
let cachedStatus: {ptyAvailable: boolean; path: string} | null = null

export async function resolveWebSocketTerminalBridge(): Promise<NativeTerminalBridge | null> {
    if (cachedBridge !== undefined) return cachedBridge
    if (typeof window === 'undefined' || window.datawise?.terminal) {
        cachedBridge = null
        return null
    }
    try {
        const {terminalApi} = await import('@/api')
        const status = await terminalApi.status()
        cachedStatus = {ptyAvailable: status.ptyAvailable, path: status.websocketPath}
        if (!status.websocketEnabled || !status.ptyAvailable) {
            cachedBridge = null
            return null
        }
        cachedBridge = createWebSocketTerminalBridge(status.websocketPath)
        return cachedBridge
    } catch {
        cachedBridge = null
        return null
    }
}

export function resetWebSocketTerminalBridgeCache(): void {
    cachedBridge = undefined
    cachedStatus = null
}

export function getCachedWebSocketTerminalStatus() {
    return cachedStatus
}
