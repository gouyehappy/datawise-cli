import type {ShortcutPanel} from '@/core/types'

export interface ShortcutRailNavDef {
    id: ShortcutPanel
    labelKey: string
    caption: string
}

export const SHORTCUT_RAIL_NAV_DEFS: ShortcutRailNavDef[] = [
    {id: 'info', labelKey: 'shortcut.objectInfo', caption: 'Info'},
    {id: 'history', labelKey: 'shortcut.sqlLog', caption: 'History'},
    {id: 'monitor', labelKey: 'shortcut.monitor.title', caption: 'Monitor'},
    {id: 'console', labelKey: 'shortcut.savedConsole', caption: 'Bookmarks'},
    {id: 'migration', labelKey: 'shortcut.migration.title', caption: 'Migrate'},
    {id: 'export', labelKey: 'shortcut.exportProgress', caption: 'Export'},
]
