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

/** 将稳定错误码映射为本地化文案；驱动类错误优先展示后端详情。 */
export function resolveDisplayApiErrorMessage(
    error: unknown,
    translate: (key: string) => string,
): string {
    const raw = resolveApiErrorMessage(error)
    const code = extractStableErrorCode(error)
    const i18nKey = stableApiErrorI18nKey(code)
    if (i18nKey) {
        const localized = translate(i18nKey)
        if (localized && localized !== i18nKey) {
            // 下载失败等场景：后端消息含仓库 URL / 配置提示，比短码更有用
            if (
                code === 'JDBC_DRIVER_DOWNLOAD_FAILED'
                || code === 'JDBC_DRIVER_LOAD_FAILED'
                || (code === 'SQL_EXECUTION_FAILED' && /download|maven|driver/i.test(raw))
            ) {
                return raw.length > localized.length ? raw : localized
            }
            return localized
        }
    }
    return raw
}
