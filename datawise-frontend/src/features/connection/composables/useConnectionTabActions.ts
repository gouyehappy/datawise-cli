import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import type {ConnectionConfig} from '@/core/types'
import type {Reactive} from 'vue'
import {isUnsavedConnectionId} from '@/features/connection/utils/connection-defaults'
import {resolveConnectionCatalogErrorMessage} from '@/features/connection/services/connection-catalog.service'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {canMutateConnectionCatalog} from '@/features/auth/services/feature-permission.service'

/** 连接 Tab：保存 / 取消 */
export function useConnectionTabActions(options: {
    tabId: string
    form: Reactive<ConnectionConfig>
    getPayload: () => ConnectionConfig
    getLabel: () => string
    editingConnectionId?: () => string | undefined
    targetGroupId?: () => string | undefined
}) {
    const {t} = useI18n()
    const explorer = useExplorerStore()
    const layout = useLayoutStore()
    const workspace = useWorkspaceStore()
    const auth = useAuthStore()
    const saving = ref(false)
    const canSave = computed(() => canMutateConnectionCatalog(auth.isGuest))

    async function saveConnection() {
        if (saving.value) return
        if (!canSave.value) {
            layout.showErrorToast(t('auth.permissionDenied'))
            return
        }

        const payload = options.getPayload()
        if (!payload.name?.trim()) {
            payload.name = `${options.getLabel()}@${payload.host || 'localhost'}`
            options.form.name = payload.name
        }

        const rawEditId = options.editingConnectionId?.()?.trim()
        const persistedEditId =
            rawEditId && !isUnsavedConnectionId(rawEditId) ? rawEditId : undefined

        saving.value = true
        try {
            if (persistedEditId) {
                payload.id = persistedEditId
                await explorer.updateConnection(persistedEditId, payload)
                layout.showToast(t('connection.updateSuccess'))
                explorer.selectNode(persistedEditId)
                explorer.expandToNode(persistedEditId)
            } else {
                const groupId = options.targetGroupId?.()
                const id = await explorer.addConnection(payload, groupId)
                if (!id) {
                    layout.showToast(t('connection.saveFailed'))
                    return
                }
                layout.showToast(t('connection.saveSuccess'))
                explorer.expandToNode(id)
                explorer.selectNode(id)
            }

            layout.setModule('database')
            workspace.closeTab(options.tabId)
        } catch (error) {
            layout.showErrorToast(resolveConnectionCatalogErrorMessage(error, t, 'save'))
        } finally {
            saving.value = false
        }
    }

    function cancel() {
        workspace.closeTab(options.tabId)
    }

    return {saveConnection, cancel, saving, canSave}
}
