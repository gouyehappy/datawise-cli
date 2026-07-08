import type {NavModule} from '@/core/types'

export type SideRailItemId = NavModule | 'refresh' | 'notify' | 'feedback' | 'terminal'

export interface SideRailNavDef {
    id: SideRailItemId
    labelKey: string
    caption: string
    section: 'main' | 'util' | 'bottom'
}

export const SIDE_RAIL_NAV_DEFS: SideRailNavDef[] = [
    {id: 'database', labelKey: 'nav.database', caption: 'Database', section: 'main'},
    {id: 'dashboard', labelKey: 'nav.dashboard', caption: 'Dashboard', section: 'main'},
    {id: 'ai', labelKey: 'nav.ai', caption: 'AI', section: 'main'},
    {id: 'plugin', labelKey: 'nav.plugin', caption: 'Plugins', section: 'main'},
    {id: 'connectorMarket', labelKey: 'nav.connectorMarket', caption: 'Connectors', section: 'main'},
    {id: 'pluginDev', labelKey: 'nav.pluginDev', caption: 'Dev', section: 'main'},
    {id: 'refresh', labelKey: 'nav.refresh', caption: 'Refresh', section: 'util'},
    {id: 'notify', labelKey: 'nav.notify', caption: 'Notify', section: 'util'},
    {id: 'feedback', labelKey: 'nav.feedback', caption: 'Feedback', section: 'util'},
    {id: 'terminal', labelKey: 'shortcut.terminal', caption: 'Terminal', section: 'bottom'},
]
