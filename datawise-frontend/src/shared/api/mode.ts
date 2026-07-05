import {backendBaseUrl} from '@/shared/config/runtime-ports'
import {isPackagedRenderer} from '@/shared/api/desktop-renderer'
import {readDatawiseHost} from '@/features/layout/services/desktop-bridge'

/** Electron 打包（file://）下无 Vite 代理时的默认后端地址（与后端 server.address=127.0.0.1 一致） */
export const DEFAULT_DESKTOP_API_BASE = backendBaseUrl('127.0.0.1')

function normalizeBaseUrl(raw: string): string {
    return raw.trim().replace(/\/$/, '')
}

function readConfiguredBaseUrl(): string {
    const fromEnv = import.meta.env?.VITE_API_BASE_URL?.trim()
    if (fromEnv) return normalizeBaseUrl(fromEnv)

    if (typeof window !== 'undefined') {
        const injected = readDatawiseHost()?.apiBaseUrl?.trim()
        if (injected) return normalizeBaseUrl(injected)
    }
    return ''
}

function shouldUseDesktopDefault(): boolean {
    if (typeof window === 'undefined') return false
    if (readDatawiseHost()) return true
    return isPackagedRenderer()
}

/** 统一读取 API 基址：浏览器开发走相对路径 + Vite 代理；Electron 打包默认本机后端端口 */
export function readApiBaseUrl(): string {
    const configured = readConfiguredBaseUrl()
    if (configured) return configured
    if (shouldUseDesktopDefault()) return DEFAULT_DESKTOP_API_BASE
    return ''
}
