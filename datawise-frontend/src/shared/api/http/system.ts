import type {ApiResponse, SystemMetricsSnapshot} from '@/shared/api/types'
import {readApiBaseUrl} from '@/shared/api/mode'
import {API_PATHS} from '@/shared/api/http/paths'
import {getJson} from '@/shared/api/http/request'

const HEALTH_TIMEOUT_MS = 5000

export interface HealthStatus {
    ok: boolean
    latencyMs: number
    serverVersion?: string
    serverTime?: string
    scriptsDir?: string
    configDir?: string
}

export interface HealthSnapshot {
    endpoint: string
    result: HealthStatus | null
}

function buildHealthUrl(): string {
    const baseUrl = readApiBaseUrl()
    return baseUrl ? `${baseUrl}${API_PATHS.health}` : API_PATHS.health
}

/** 展示用后端地址 */
export function resolveBackendEndpointLabel(): string {
    const baseUrl = readApiBaseUrl()
    if (baseUrl) return baseUrl
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/api`
    }
    return '/api'
}

export async function pingHealth(): Promise<HealthSnapshot> {
    const endpoint = resolveBackendEndpointLabel()
    const url = buildHealthUrl()
    const started = performance.now()

    try {
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        })
        const latencyMs = Math.round(performance.now() - started)
        const payload = (await response.json()) as ApiResponse<{
            status?: string
            version?: string
            serverTime?: string
            scriptsDir?: string
            configDir?: string
        }>

        if (!response.ok || payload.code !== 0 || payload.data?.status !== 'ok') {
            return {endpoint, result: {ok: false, latencyMs}}
        }

        return {
            endpoint,
            result: {
                ok: true,
                latencyMs,
                serverVersion: payload.data.version,
                serverTime: payload.data.serverTime,
                scriptsDir: payload.data.scriptsDir,
                configDir: payload.data.configDir,
            },
        }
    } catch {
        return {
            endpoint,
            result: {
                ok: false,
                latencyMs: Math.round(performance.now() - started),
            },
        }
    }
}

export function createHttpSystemApi() {
    return {
        ping: pingHealth,
        resolveEndpointLabel: resolveBackendEndpointLabel,
        fetchMetrics: () => getJson<SystemMetricsSnapshot>(API_PATHS.metrics),
    }
}
