import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {ensureWatchedConnectionId} from '@/features/explorer/services/connection-health-alert.service'

/** 连接被实际使用后纳入健康检查（周期探测 + 可选监视列表）。 */
export function registerConnectionHealthCheck(
    connectionId: string,
    outcome: 'ok' | 'error' = 'ok',
) {
    if (!connectionId) return

    const explorer = useExplorerStore()
    explorer.markConnectionAttempted(connectionId)
    explorer.setConnectionHealth(connectionId, outcome)

    const appConfig = useAppConfigStore()
    const nextWatched = ensureWatchedConnectionId(
        connectionId,
        appConfig.connectionHealthPreferences,
    )
    if (nextWatched) {
        appConfig.patchConnectionHealth({watchedConnectionIds: nextWatched})
    }
}
