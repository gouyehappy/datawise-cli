import type {SqlCompletionContext} from './context'
import type {CompletionSnapshot} from './core/snapshot'

type CacheEntry = {
    sql: string
    offset: number
    schemaKey: string
    ctx?: SqlCompletionContext
    snapshot?: CompletionSnapshot
}

const CACHE_MAX = 48
const cache = new Map<string, CacheEntry>()

export function schemaFingerprint(
    tables: string[],
    columns: Record<string, { name: string }[]>,
): string {
    if (!tables.length) return '0'
    const sorted = [...tables].sort()
    let hash = 2166136261
    for (const table of sorted) {
        for (let i = 0; i < table.length; i++) {
            hash ^= table.charCodeAt(i)
            hash = Math.imul(hash, 16777619)
        }
        hash ^= 0xff
        const colCount = columns[table]?.length ?? 0
        hash ^= colCount
        hash = Math.imul(hash, 16777619)
    }
    return `${sorted.length}:${hash >>> 0}`
}

function cacheKey(sql: string, offset: number, schemaKey: string): string {
    return `${sql.length}:${offset}:${schemaKey}`
}

function isValidEntry(
    hit: CacheEntry | undefined,
    sql: string,
    offset: number,
    schemaKey: string,
): hit is CacheEntry {
    if (!hit) return false
    if (hit.sql !== sql || hit.offset !== offset || hit.schemaKey !== schemaKey) {
        return false
    }
    return true
}

function touchEntry(key: string, entry: CacheEntry): void {
    cache.delete(key)
    cache.set(key, entry)
    if (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next().value
        if (oldest) cache.delete(oldest)
    }
}

export function getCachedAnalysis(
    sql: string,
    offset: number,
    schemaKey: string,
): SqlCompletionContext | null {
    const key = cacheKey(sql, offset, schemaKey)
    const hit = cache.get(key)
    if (!isValidEntry(hit, sql, offset, schemaKey)) {
        if (hit) cache.delete(key)
        return null
    }
    return hit.ctx ?? null
}

export function getCachedSnapshot(
    sql: string,
    offset: number,
    schemaKey: string,
): CompletionSnapshot | null {
    const key = cacheKey(sql, offset, schemaKey)
    const hit = cache.get(key)
    if (!isValidEntry(hit, sql, offset, schemaKey)) {
        if (hit) cache.delete(key)
        return null
    }
    return hit.snapshot ?? null
}

export function setCachedAnalysis(
    sql: string,
    offset: number,
    schemaKey: string,
    ctx: SqlCompletionContext,
): void {
    const key = cacheKey(sql, offset, schemaKey)
    const prev = cache.get(key)
    const keepSnapshot =
        isValidEntry(prev, sql, offset, schemaKey) && prev.ctx === ctx && prev.snapshot
    touchEntry(key, {
        sql,
        offset,
        schemaKey,
        ctx,
        snapshot: keepSnapshot ? prev.snapshot : undefined,
    })
}

export function setCachedSnapshot(
    sql: string,
    offset: number,
    schemaKey: string,
    snapshot: CompletionSnapshot,
): void {
    const key = cacheKey(sql, offset, schemaKey)
    touchEntry(key, {
        sql,
        offset,
        schemaKey,
        ctx: snapshot.context,
        snapshot,
    })
}

export function clearAnalysisCache(): void {
    cache.clear()
}
