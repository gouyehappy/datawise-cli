import type {ConnectionConfig, DbType} from '@/core/types'
import {
    getExplorerAddMenuItems,
    parseDbTypeMenuId,
} from '@/features/explorer/constants/explorer-add-menu'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
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

    const menuItems = getExplorerAddMenuItems(t)

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
                layout.showToast(t('explorer.importSuccess', {count}))
            } catch {
                layout.showToast(t('explorer.importFailed'))
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
            close()
            options?.onCreateFolder?.()
            return
        }
        if (id === 'import-connections') {
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
