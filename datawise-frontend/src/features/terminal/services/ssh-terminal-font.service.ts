import type {Terminal} from '@xterm/xterm'

const FONT_SIZE_KEY = 'ssh-terminal-font-size'
const MIN_FONT_SIZE = 11
const MAX_FONT_SIZE = 20
const DEFAULT_FONT_SIZE = 13

export function readSshTerminalFontSize(): number {
    try {
        const raw = localStorage.getItem(FONT_SIZE_KEY)
        const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_FONT_SIZE
        if (!Number.isFinite(parsed)) return DEFAULT_FONT_SIZE
        return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parsed))
    } catch {
        return DEFAULT_FONT_SIZE
    }
}

export function writeSshTerminalFontSize(size: number): number {
    const normalized = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)))
    localStorage.setItem(FONT_SIZE_KEY, String(normalized))
    return normalized
}

export function adjustSshTerminalFontSize(current: number, delta: number): number {
    return writeSshTerminalFontSize(current + delta)
}

export function applyTerminalFontSize(terminal: Terminal | null, size: number): number {
    const normalized = writeSshTerminalFontSize(size)
    if (terminal) {
        terminal.options.fontSize = normalized
    }
    return normalized
}

export const SSH_TERMINAL_FONT_LIMITS = {
    min: MIN_FONT_SIZE,
    max: MAX_FONT_SIZE,
    default: DEFAULT_FONT_SIZE,
} as const
