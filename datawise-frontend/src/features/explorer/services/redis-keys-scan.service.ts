export interface RedisKeysScanResult {
    keys: string[]
    cursor: string
    hasMore: boolean
    dbSize: number
}

export const REDIS_KEYS_PAGE_SIZE = 50

export function normalizeRedisScanPattern(pattern: string): string {
    const trimmed = pattern.trim()
    if (!trimmed) return '*'
    if (/[*?[\]]/.test(trimmed)) return trimmed
    return `${trimmed}*`
}
