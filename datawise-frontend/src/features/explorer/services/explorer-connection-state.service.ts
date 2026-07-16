/** Explorer 连接树：温热池（已连接）与可达性（ping）分离 */

export type ConnectionReachability = 'ok' | 'error'

/** Align with backend JdbcConnectionPoolWarmupService.usesJdbcPool (+ ssh never uses JDBC pools). */
const NON_JDBC_POOL_DB_TYPES = new Set([
    'redis',
    'kafka',
    'yarn',
    'mongodb',
    'ssh',
])

export function usesJdbcConnectionPool(dbType?: string | null): boolean {
    if (!dbType?.trim()) return false
    return !NON_JDBC_POOL_DB_TYPES.has(dbType.trim().toLowerCase())
}

export function resolveConnectionDisplayHealth(
    connectionId: string,
    pooledIds: ReadonlySet<string>,
    reachabilityById: Record<string, ConnectionReachability>,
): ConnectionReachability | undefined {
    if (!pooledIds.has(connectionId)) return undefined
    return reachabilityById[connectionId] === 'error' ? 'error' : 'ok'
}

export function buildConnectionDisplayHealthMap(
    pooledIds: ReadonlySet<string>,
    reachabilityById: Record<string, ConnectionReachability>,
): Record<string, ConnectionReachability> {
    const next: Record<string, ConnectionReachability> = {}
    for (const connectionId of pooledIds) {
        const display = resolveConnectionDisplayHealth(connectionId, pooledIds, reachabilityById)
        if (display) next[connectionId] = display
    }
    return next
}

export function resolveConnectionLinkState(
    connectionId: string,
    pooledIds: ReadonlySet<string>,
    reachabilityById: Record<string, ConnectionReachability>,
    loadingNodeIds: ReadonlySet<string>,
): 'connected' | 'disconnected' | 'error' | 'loading' {
    if (loadingNodeIds.has(connectionId)) return 'loading'
    if (!pooledIds.has(connectionId)) {
        return reachabilityById[connectionId] === 'error' ? 'error' : 'disconnected'
    }
    return reachabilityById[connectionId] === 'error' ? 'error' : 'connected'
}

/**
 * Merge server JDBC pool membership with UI-connected non-JDBC datasources.
 * Avoids wiping Redis/Kafka/SSH green badges on the periodic pool sync.
 */
export function mergePooledConnectionSync(input: {
    serverPooledIds: readonly string[]
    previousPooledIds: ReadonlySet<string>
    resolveDbType: (connectionId: string) => string | undefined | null
    isUiConnected: (connectionId: string) => boolean
}): {nextPooledIds: Set<string>; evictedIds: string[]} {
    const nextPooledIds = new Set(input.serverPooledIds)
    const evictedIds: string[] = []

    for (const connectionId of input.previousPooledIds) {
        if (nextPooledIds.has(connectionId)) continue
        const dbType = input.resolveDbType(connectionId)
        if (!usesJdbcConnectionPool(dbType) && input.isUiConnected(connectionId)) {
            nextPooledIds.add(connectionId)
            continue
        }
        evictedIds.push(connectionId)
    }

    return {nextPooledIds, evictedIds}
}
