import {ApiError, HTTP_NOT_READY} from '@/shared/api/http/request'

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
