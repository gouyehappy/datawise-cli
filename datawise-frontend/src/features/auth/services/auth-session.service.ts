import {ApiError} from '@/shared/api/http/request'

export function isUnauthorizedApiError(error: unknown): boolean {
    return error instanceof ApiError && error.message.trim() === 'UNAUTHORIZED'
}

export function shouldValidateBackendSession(hadSession: boolean, backendConnected: boolean): boolean {
    return hadSession && backendConnected
}

export function shouldRecoverStaleSession(error: unknown): boolean {
    return isUnauthorizedApiError(error)
}
