import {api} from '@/shared/api'

/** 应用设置：后端健康检查、系统指标 */
export const settingsApi = {
    pingHealth: () => api.system.ping(),
    pingHealthAt: (baseUrl: string) => api.system.pingAt(baseUrl),
    resolveBackendEndpointLabel: () => api.system.resolveEndpointLabel(),
    fetchMetrics: () => api.system.fetchMetrics(),
}
