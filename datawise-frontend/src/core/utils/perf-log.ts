/** Dev-only structured timing logs (browser console). */
import {shouldEmitPerfLog} from '@/features/settings/services/perf-diagnostics.service'

export function perfNow(): number {
    return performance.now()
}

export function logPerf(operation: string, startedAt: number, details?: Record<string, unknown>): void {
    const connectionId = typeof details?.connectionId === 'string' ? details.connectionId : undefined
    if (!shouldEmitPerfLog(connectionId)) {
        return
    }
    const durationMs = Math.round(performance.now() - startedAt)
    if (details && Object.keys(details).length > 0) {
        console.info(`[PERF] ${operation} ${durationMs}ms`, details)
        return
    }
    console.info(`[PERF] ${operation} ${durationMs}ms`)
}
