import type {ContextMenuItem, DbType} from '@/core/types'
import type {ComposerTranslation} from 'vue-i18n'

export const DB_TYPE_MENU_PREFIX = 'db-type:'

export function getExplorerAddMenuItems(t: ComposerTranslation): ContextMenuItem[] {
    return [
        {id: 'new-folder', label: t('explorer.newFolder'), icon: 'file'},
        {
            id: 'add-connection',
            label: t('explorer.newConnection'),
            icon: 'connection',
            submenuPanel: 'db-type',
        },
        {id: 'divider-1', label: '', divider: true},
        {id: 'import-connections', label: t('explorer.importConnections'), icon: 'import'},
    ]
}

export function isDbTypeMenuId(id: string): boolean {
    return id.startsWith(DB_TYPE_MENU_PREFIX)
}

export function parseDbTypeMenuId(id: string): DbType | null {
    if (!isDbTypeMenuId(id)) return null
    return id.slice(DB_TYPE_MENU_PREFIX.length) as DbType
}

export function toDbTypeMenuId(dbType: DbType): string {
    return `${DB_TYPE_MENU_PREFIX}${dbType}`
}
