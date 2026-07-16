import {computed} from 'vue'
import type {ConnectionConfig, DbType} from '@/core/types'
import {
    filterExplorerAddMenuItems,
    getExplorerAddMenuItems,
    parseDbTypeMenuId,
} from '@/features/explorer/constants/explorer-add-menu'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {
    canImportExplorerConnections,
    canMutateConnectionCatalog,
} from '@/features/auth/services/feature-permission.service'
import {resolveConnectionCatalogErrorMessage} from '@/features/connection/services/connection-catalog.service'
import {useI18n} from 'vue-i18n'

/** 工具栏「+」添加数据源菜单逻辑 */
export function useExplorerAddMenu(options?: {
    onClose?: () => void
    onCreateFolder?: () => void
}) {
    const {t} = useI18n()
    const explorer = useExplorerStore()
    const layout = useLayoutStore()
    const workspace = useWorkspaceStore()
    const auth = useAuthStore()

    const menuItems = computed(() =>
        filterExplorerAddMenuItems(getExplorerAddMenuItems(t), auth.isGuest),
    )

    function close() {
        options?.onClose?.()
    }

    function openConnectionForm(dbType: DbType) {
        workspace.openConnectionForm(dbType)
        close()
    }

    function importConnections() {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json,application/json'
        input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) return
            try {
                const parsed = JSON.parse(await file.text()) as ConnectionConfig | ConnectionConfig[]
                const list = Array.isArray(parsed) ? parsed : [parsed]
                const count = await explorer.importConnections(list)
                layout.showSuccessToast(t('explorer.importSuccess', {count}))
            } catch (error) {
                layout.showErrorToast(resolveConnectionCatalogErrorMessage(error, t, 'save'))
            }
            close()
        }
        input.click()
    }

    function onMenuSelect(id: string) {
        const dbType = parseDbTypeMenuId(id)
        if (dbType) {
            openConnectionForm(dbType)
            return
        }
        if (id === 'new-folder') {
            if (!canMutateConnectionCatalog(auth.isGuest)) {
                layout.showErrorToast(t('auth.permissionDenied'))
                close()
                return
            }
            close()
            options?.onCreateFolder?.()
            return
        }
        if (id === 'import-connections') {
            if (!canImportExplorerConnections(auth.isGuest)) {
                layout.showErrorToast(t('auth.permissionDenied'))
                close()
                return
            }
            importConnections()
            return
        }
        close()
    }

    return {
        menuItems,
        onMenuSelect,
        openConnectionForm,
    }
}
