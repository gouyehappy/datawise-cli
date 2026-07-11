import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {
    isProductionPerfActive,
    isProductionPerfModeEnabled,
} from '@/features/settings/services/production-perf-mode.service'

/** 是否向控制台输出 [PERF] 结构化耗时日志 */
export function shouldEmitPerfLog(connectionId?: string): boolean {
    if (import.meta.env.DEV) return true
    if (!isProductionPerfModeEnabled()) return false
    if (!connectionId?.trim()) return false
    const explorer = useExplorerStore()
    return isProductionPerfActive(connectionId, explorer.findNode)
}
