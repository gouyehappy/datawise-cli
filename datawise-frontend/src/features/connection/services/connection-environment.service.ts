import type {StatusVariant} from '@/core/utils/status-variant'

/** Standard connection environment values (B-01). */
export type ConnectionEnvironment = 'dev' | 'staging' | 'prod' | 'custom'

export const CONNECTION_ENV_OPTIONS: ConnectionEnvironment[] = ['dev', 'staging', 'prod', 'custom']

export const CONNECTION_ENV_DEFAULT: ConnectionEnvironment = 'dev'

const CUSTOM_LABEL_MAX_LENGTH = 32

export interface NormalizedConnectionEnvironment {
    env: ConnectionEnvironment
    envCustom?: string
}

function sanitizeCustom(value?: string | null): string | undefined {
    const trimmed = value?.trim()
    if (!trimmed) return undefined
    if (trimmed.length <= CUSTOM_LABEL_MAX_LENGTH) return trimmed
    return trimmed.slice(0, CUSTOM_LABEL_MAX_LENGTH)
}

/** Normalize legacy uppercase / free-text env values on read or before save. */
export function normalizeConnectionEnvironment(
    env?: string | null,
    envCustom?: string | null,
): NormalizedConnectionEnvironment {
    if (!env?.trim()) {
        return {env: CONNECTION_ENV_DEFAULT}
    }
    const trimmed = env.trim()
    const lower = trimmed.toLowerCase()
    switch (lower) {
        case 'dev':
        case 'development':
        case 'test':
            return {env: 'dev'}
        case 'staging':
        case 'stage':
        case 'uat':
            return {env: 'staging'}
        case 'prod':
        case 'production':
            return {env: 'prod'}
        case 'custom':
            return {env: 'custom', envCustom: sanitizeCustom(envCustom)}
        default:
            return {env: 'custom', envCustom: sanitizeCustom(trimmed)}
    }
}

export function resolveConnectionEnvironmentVariant(env: ConnectionEnvironment): StatusVariant {
    switch (env) {
        case 'prod':
            return 'error'
        case 'staging':
            return 'warn'
        case 'dev':
            return 'primary'
        case 'custom':
        default:
            return 'neutral'
    }
}

export function resolveConnectionEnvironmentLabel(
    env: ConnectionEnvironment | string | undefined,
    envCustom?: string | null,
    translate?: (key: string) => string,
): string {
    const normalized = normalizeConnectionEnvironment(env, envCustom)
    if (normalized.env === 'custom') {
        return normalized.envCustom
            ?? (translate ? translate('connection.envOptions.custom') : 'custom')
    }
    const key = `connection.envOptions.${normalized.env}`
    return translate ? translate(key) : normalized.env
}

export function isConnectionEnvironment(value: string): value is ConnectionEnvironment {
    return (CONNECTION_ENV_OPTIONS as readonly string[]).includes(value)
}

export function isProductionEnvironment(
    env?: string | null,
    envCustom?: string | null,
): boolean {
    return normalizeConnectionEnvironment(env, envCustom).env === 'prod'
}
