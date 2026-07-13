export type SshTerminalStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface SshTerminalHandle {
    tabId: string
    connectionId: string
    label: string
    sendInput: (text: string) => Promise<boolean>
    focus: () => void
    getStatus: () => SshTerminalStatus
    reconnect: () => Promise<void>
}

const handles = new Map<string, SshTerminalHandle>()

export function registerSshTerminalHandle(handle: SshTerminalHandle): void {
    handles.set(handle.tabId, handle)
}

export function unregisterSshTerminalHandle(tabId: string): void {
    handles.delete(tabId)
}

export function listSshTerminalHandles(connectionId: string): SshTerminalHandle[] {
    return [...handles.values()].filter((item) => item.connectionId === connectionId)
}

export function findSshTerminalHandle(
    connectionId: string,
    preferTabId?: string,
): SshTerminalHandle | null {
    if (preferTabId) {
        const preferred = handles.get(preferTabId)
        if (preferred?.connectionId === connectionId) {
            return preferred
        }
    }
    const candidates = listSshTerminalHandles(connectionId)
    const connected = candidates.find((item) => item.getStatus() === 'connected')
    return connected ?? candidates[0] ?? null
}

export async function sendToSshTerminal(
    connectionId: string,
    text: string,
    options?: {appendNewline?: boolean; preferTabId?: string; focus?: boolean},
): Promise<boolean> {
    const trimmed = text.trim()
    if (!trimmed) return false
    const handle = findSshTerminalHandle(connectionId, options?.preferTabId)
    if (!handle) return false
    if (handle.getStatus() !== 'connected') {
        await handle.reconnect()
    }
    const payload = options?.appendNewline === false ? trimmed : `${trimmed}\n`
    const ok = await handle.sendInput(payload)
    if (ok && options?.focus !== false) {
        handle.focus()
    }
    return ok
}

export function formatSshEndpoint(user?: string, host?: string, port?: string): string {
    const endpoint = host?.trim() || ''
    if (!endpoint) return ''
    const portPart = port?.trim() ? `:${port.trim()}` : ''
    const userPart = user?.trim() ? `${user.trim()}@` : ''
    return `${userPart}${endpoint}${portPart}`
}
