import type {ApiError} from '@/shared/api/http/request'
import {t} from '@/i18n'

export const JDBC_DRIVER_ERROR_CODE = 'JDBC_DRIVER_REQUIRED'
export const JDBC_DRIVER_LOAD_ERROR_CODE = 'JDBC_DRIVER_LOAD_FAILED'

type ApiErrorData = {
    errorCode?: string
}

export function readApiErrorCode(error: unknown): string | undefined {
    if (!(error instanceof Error) || error.name !== 'ApiError') return undefined
    const data = (error as ApiError).data as ApiErrorData | undefined
    return data?.errorCode
}

export function isJdbcDriverError(error: unknown): boolean {
    const code = readApiErrorCode(error)
    return code === JDBC_DRIVER_ERROR_CODE || code === JDBC_DRIVER_LOAD_ERROR_CODE
}

export function resolveConnectionErrorMessage(error: unknown): string {
    const code = readApiErrorCode(error)
    if (code === JDBC_DRIVER_ERROR_CODE) {
        return t('explorer.connectionDriverMissing')
    }
    if (code === JDBC_DRIVER_LOAD_ERROR_CODE) {
        return t('explorer.connectionDriverLoadFailed')
    }
    if (error instanceof Error && error.name === 'ApiError' && error.message.trim()) {
        return error.message.trim()
    }
    if (error instanceof Error && error.message.trim()) {
        return error.message.trim()
    }
    return t('explorer.connectionLoadFailed')
}
