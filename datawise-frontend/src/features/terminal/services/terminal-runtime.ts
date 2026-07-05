import {isNativeTerminalAvailable} from '@/features/terminal/services/native-terminal'

export type TerminalRuntimeMode = 'native' | 'demo'

export function getTerminalRuntimeMode(): TerminalRuntimeMode {
    return isNativeTerminalAvailable() ? 'native' : 'demo'
}

export function resolveHostPlatform(): string {
    if (typeof window !== 'undefined' && window.datawise?.platform) {
        return window.datawise.platform
    }
    return typeof navigator !== 'undefined' ? navigator.platform : 'web'
}

/** Matches electron/terminal-service resolveShell() defaults for UI labels. */
export function defaultNativeShellLabel(platform = resolveHostPlatform()): string {
    const normalized = platform.toLowerCase()
    if (normalized.startsWith('win')) {
        return 'powershell.exe'
    }
    return '/bin/bash'
}
