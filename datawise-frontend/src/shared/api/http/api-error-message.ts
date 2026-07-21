import {ApiError, HTTP_NOT_READY} from '@/shared/api/http/request'
import {stableApiErrorI18nKey} from '@/shared/api/http/api-error-codes'

/** 将 API / 网络错误转为可展示文案 */
export function resolveApiErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        const message = error.message?.trim()
        return message || HTTP_NOT_READY
    }
    if (error instanceof Error) {
        const message = error.message?.trim()
        return message || HTTP_NOT_READY
    }
    return HTTP_NOT_READY
}

function extractStableErrorCode(error: unknown): string | null {
    if (error instanceof ApiError && error.data && typeof error.data === 'object') {
        const code = (error.data as {errorCode?: unknown}).errorCode
        if (typeof code === 'string' && code.trim()) {
            return code.trim()
        }
    }
    if (error instanceof ApiError) {
        return error.message?.trim() || null
    }
    if (error instanceof Error) {
        return error.message?.trim() || null
    }
    return null
}

/** 将稳定错误码映射为本地化文案；未知码回退 raw message。 */
export function resolveDisplayApiErrorMessage(
    error: unknown,
    translate: (key: string) => string,
): string {
    const code = extractStableErrorCode(error)
    const i18nKey = stableApiErrorI18nKey(code)
    if (i18nKey) {
        const localized = translate(i18nKey)
        if (localized && localized !== i18nKey) return localized
    }
    return resolveApiErrorMessage(error)
}
