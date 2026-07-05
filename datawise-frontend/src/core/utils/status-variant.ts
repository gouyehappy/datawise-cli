/** 统一状态视觉变体 — 全应用状态徽章、日志行、进度条共用 */
export type StatusVariant =
    | 'success'
    | 'error'
    | 'warn'
    | 'running'
    | 'info'
    | 'neutral'
    | 'primary'
    | 'accent'

export type StatusDomain =
    | 'export'
    | 'migration'
    | 'log'
    | 'preflight'
    | 'validation'
    | 'schema'
    | 'connection'

const SUCCESS_STATUSES = new Set(['success', 'ok', 'done', 'match', 'ready'])
const ERROR_STATUSES = new Set(['error', 'failed', 'blocked', 'mismatch'])
const WARN_STATUSES = new Set(['warn', 'warning', 'partial', 'skipped', 'paused'])
const RUNNING_STATUSES = new Set(['running', 'pending', 'in_progress'])

/**
 * 将业务状态字符串解析为统一视觉变体。
 * 未知状态回退为 neutral，避免样式缺失。
 */
export function resolveStatusVariant(
    status: string | null | undefined,
    domain?: StatusDomain,
): StatusVariant {
    const normalized = (status ?? '').trim().toLowerCase()
    if (!normalized) return 'neutral'

    if (domain === 'log') {
        return normalized === 'error' ? 'error' : 'success'
    }

    if (domain === 'preflight') {
        if (normalized === 'ready') return 'success'
        if (normalized === 'warn') return 'warn'
        if (normalized === 'blocked') return 'error'
    }

    if (domain === 'validation') {
        if (normalized === 'match') return 'success'
        if (normalized === 'mismatch') return 'error'
        if (normalized === 'skipped') return 'warn'
    }

    if (domain === 'schema') {
        if (normalized === 'added') return 'success'
        if (normalized === 'removed') return 'error'
        if (normalized === 'changed') return 'primary'
        if (normalized === 'unchanged') return 'neutral'
    }

    if (domain === 'connection') {
        if (normalized === 'ok') return 'success'
        if (normalized === 'error') return 'error'
        return 'neutral'
    }

    if (RUNNING_STATUSES.has(normalized)) return 'running'
    if (SUCCESS_STATUSES.has(normalized)) return 'success'
    if (ERROR_STATUSES.has(normalized)) return 'error'
    if (WARN_STATUSES.has(normalized)) return 'warn'
    if (normalized === 'info') return 'info'

    return 'neutral'
}

/** 日志级别 → 视觉变体（用于日志行着色） */
export function resolveLogLevelVariant(level: string | null | undefined): StatusVariant {
    const normalized = (level ?? '').trim().toLowerCase()
    if (normalized === 'success') return 'success'
    if (normalized === 'warn' || normalized === 'warning') return 'warn'
    if (normalized === 'error') return 'error'
    return 'info'
}

/** CSS 修饰类名 */
export function statusVariantClass(variant: StatusVariant): string {
    return `dw-status--${variant}`
}
