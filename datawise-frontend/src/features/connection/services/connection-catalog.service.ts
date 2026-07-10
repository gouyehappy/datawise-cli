import {isUnsavedConnectionId} from '@/features/connection/utils/connection-defaults'
import {ApiError} from '@/shared/api/http/request'

export type ConnectionCatalogMutation = 'save' | 'delete'

export function isPersistedConnectionId(connectionId: string | undefined): boolean {
    return Boolean(connectionId?.trim()) && !isUnsavedConnectionId(connectionId)
}

export function resolveConnectionCatalogErrorMessage(
    error: unknown,
    translate: (key: string) => string,
    mutation: ConnectionCatalogMutation,
): string {
    const raw = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : ''
    if (raw.includes('CONNECTION_ACCESS_DENIED')) {
        return translate(
            mutation === 'delete'
                ? 'connection.deleteAccessDenied'
                : 'connection.saveAccessDenied',
        )
    }
    return raw || translate(
        mutation === 'delete'
            ? 'explorer.deleteFailed'
            : 'connection.saveFailed',
    )
}

/** @deprecated use resolveConnectionCatalogErrorMessage */
export function resolveConnectionSaveErrorMessage(
    error: unknown,
    translate: (key: string) => string,
): string {
    return resolveConnectionCatalogErrorMessage(error, translate, 'save')
}
