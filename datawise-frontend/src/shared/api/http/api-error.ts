/** 带结构化 data 的 API 错误（如 SQL errorLine） */
export class ApiError extends Error {
    readonly data?: unknown

    constructor(message: string, data?: unknown) {
        super(message)
        this.name = 'ApiError'
        this.data = data
    }
}

export function isUnauthorizedApiError(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false
    const message = error.message.trim()
    return message === 'UNAUTHORIZED' || message === 'HTTP 401'
}

export function shouldRecoverStaleSession(error: unknown): boolean {
    return isUnauthorizedApiError(error)
}
