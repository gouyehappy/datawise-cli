import type {SqlSessionStatus} from '@/shared/api/types'
import {ApiError} from '@/shared/api/http/request'

export const DEFAULT_SQL_SESSION_STATUS: SqlSessionStatus = {
    autocommit: true,
    pending: false,
}

export function isManualTransactionMode(status: SqlSessionStatus | null | undefined): boolean {
    return status != null && !status.autocommit
}

export function canCommitOrRollback(status: SqlSessionStatus | null | undefined): boolean {
    return isManualTransactionMode(status) && Boolean(status?.pending)
}

export function canBeginTransaction(
    status: SqlSessionStatus | null | undefined,
    connectionId?: string,
): boolean {
    return Boolean(connectionId) && (status == null || status.autocommit)
}

export function resolveTransactionScopeKey(
    connectionId?: string,
    database?: string,
): string {
    return `${connectionId ?? ''}:${database ?? ''}`
}

export function resolveTransactionErrorMessage(
    error: unknown,
    translate: (key: string) => string,
): string {
    const raw = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : ''
    if (raw.includes('CONNECTION_ACCESS_DENIED')) {
        return translate('console.transaction.dmlAccessDenied')
    }
    return raw || translate('console.transaction.actionFailed')
}
