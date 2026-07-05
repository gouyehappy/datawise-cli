export interface RedisCommandResult {
    command: string
    output: string
    success: boolean
    error: string | null
    durationMs: number
}

export interface RedisConsoleEntry {
    command: string
    output: string
    success: boolean
    durationMs: number
}

export function formatRedisConsoleEntry(entry: RedisConsoleEntry): string {
    const header = `> ${entry.command}`
    if (!entry.success) {
        return `${header}\n(error) ${entry.output}`
    }
    const body = entry.output || '(empty)'
    return `${header}\n${body}`
}
