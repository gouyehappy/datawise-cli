import {ApiError, isUnauthorizedApiError} from '@/shared/api/http/api-error'

export type SessionGuardOptions = {
    authBypass?: boolean
}

let sessionBlocked = false
let recoveryHandler: ((options?: SessionGuardOptions) => void) | null = null

export function registerUnauthorizedRecoveryHandler(
    handler: ((options?: SessionGuardOptions) => void) | null,
): void {
    recoveryHandler = handler
}

export function isApiSessionBlocked(): boolean {
    return sessionBlocked
}

export function shouldBypassSessionGuard(options?: SessionGuardOptions): boolean {
    return options?.authBypass === true
}

export function scheduleUnauthorizedRecovery(options?: SessionGuardOptions): void {
    if (shouldBypassSessionGuard(options)) return
    sessionBlocked = true
    recoveryHandler?.(options)
}

export function rejectBlockedApiRequest(): never {
    throw new ApiError('UNAUTHORIZED')
}

export function maybeRejectBlockedRequest(options?: SessionGuardOptions): void {
    if (sessionBlocked && !shouldBypassSessionGuard(options)) {
        rejectBlockedApiRequest()
    }
}

export function notifyUnauthorizedIfNeeded(error: ApiError, options?: SessionGuardOptions): void {
    if (isUnauthorizedApiError(error)) {
        scheduleUnauthorizedRecovery(options)
    }
}

export function unblockApiSession(): void {
    sessionBlocked = false
}

/** @internal test helper */
export function resetUnauthorizedRecoveryState(): void {
    sessionBlocked = false
    recoveryHandler = null
}

/** @internal test helper */
export function markApiSessionBlockedForTest(): void {
    sessionBlocked = true
}
