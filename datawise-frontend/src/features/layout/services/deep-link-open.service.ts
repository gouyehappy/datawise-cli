import {t} from '@/i18n'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import type {DeepLinkOpenPayload} from '@/shared/deep-link/deep-link.types'

export async function applyDeepLinkOpen(payload: DeepLinkOpenPayload): Promise<void> {
    const layout = useLayoutStore()
    const workspace = useWorkspaceStore()

    layout.setModule('database')

    try {
        await workspace.openConsole({
            connectionId: payload.connectionId,
            database: payload.database,
            sql: payload.sql,
        })
    } catch {
        layout.showToast(t('settings.basic.deepLink.openFailed'))
    }
}
