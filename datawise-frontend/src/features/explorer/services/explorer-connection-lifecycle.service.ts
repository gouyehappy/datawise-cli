import type {ComposerTranslation} from 'vue-i18n'
import type {ContextMenuItem} from '@/core/types'

export type ConnectionLinkState = 'connected' | 'disconnected' | 'error' | 'loading'

export function resolveConnectionLinkState(
    connectionId: string,
    healthById: Record<string, 'ok' | 'error'>,
    loadingNodeIds: ReadonlySet<string>,
): ConnectionLinkState {
    if (loadingNodeIds.has(connectionId)) return 'loading'
    const health = healthById[connectionId]
    if (health === 'ok') return 'connected'
    if (health === 'error') return 'error'
    return 'disconnected'
}

export function buildConnectionLifecycleMenuItems(
    t: ComposerTranslation,
    state: ConnectionLinkState,
): ContextMenuItem[] {
    const c = (key: string) => t(`explorer.context.${key}`)
    return [
        {
            id: 'connect',
            label: c('connectConnection'),
            icon: 'connection',
            disabled: state === 'connected' || state === 'loading',
        },
        {
            id: 'disconnect',
            label: c('disconnectConnection'),
            icon: 'connection',
            disabled: state === 'disconnected' || state === 'loading',
        },
        {
            id: 'reconnect',
            label: c('reconnectConnection'),
            icon: 'connection',
            disabled: state === 'loading',
        },
        {id: 'divider-connect', label: '', divider: true},
    ]
}

export function prependConnectionLifecycleMenu(
    items: ContextMenuItem[],
    lifecycleItems: ContextMenuItem[],
): ContextMenuItem[] {
    return [...lifecycleItems, ...items]
}
