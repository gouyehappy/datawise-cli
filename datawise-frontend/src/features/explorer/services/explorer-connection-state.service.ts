/** Explorer 连接树：温热池（已连接）与可达性（ping）分离 */

export type ConnectionReachability = 'ok' | 'error'

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
