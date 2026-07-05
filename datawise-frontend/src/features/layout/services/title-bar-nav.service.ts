import type {NavModule, SettingsSection} from '@/core/types'
import type {TitleBarMenuIconId} from '@/features/layout/components/TitleBarMenuIcon.vue'

export type TitleBarMenuKind = 'nav' | 'action' | 'header'
export type TitleBarMenuMode = 'leaf' | 'dropdown'

export interface TitleBarMenuItem {
    id: string
    labelKey: string
    icon?: TitleBarMenuIconId
    menuMode?: TitleBarMenuMode
    kind?: TitleBarMenuKind
    hintKey?: string
    active?: boolean
    checked?: boolean
    badge?: number
    divider?: boolean
    run?: () => void
    children?: TitleBarMenuItem[]
}

export interface TitleBarNavHandlers {
    setModule: (module: NavModule) => void
    openSettings: (section?: SettingsSection) => void
    openPluginDevTools: () => void
}

export interface TitleBarNavContext {
    activeModule: NavModule
    settingsSection: SettingsSection
    devToolsVisible: boolean
    presetConflictCount: number
    catalogIssueCount: number
    aiWorkbenchEnabled: boolean
}

type LeafOptions = Pick<TitleBarMenuItem, 'active' | 'badge' | 'icon'>

function leaf(
    id: string,
    labelKey: string,
    run: () => void,
    options: LeafOptions = {},
): TitleBarMenuItem {
    return {id, labelKey, kind: 'nav', run, ...options}
}

function settingsSectionIcon(section: SettingsSection): TitleBarMenuIconId {
    switch (section) {
        case 'basic': return 'basic'
        case 'layout': return 'layout'
        case 'plugins': return 'plugins'
        case 'editor': return 'editor'
        case 'shortcuts': return 'shortcuts'
        case 'ai': return 'ai'
        case 'about': return 'about'
        default: return 'settings'
    }
}

function settingsMenu(ctx: TitleBarNavContext, h: TitleBarNavHandlers): TitleBarMenuItem {
    const sections: {id: SettingsSection; labelKey: string}[] = [
        {id: 'basic', labelKey: 'settings.nav.basic'},
        {id: 'layout', labelKey: 'settings.nav.layout'},
        {id: 'editor', labelKey: 'settings.nav.editor'},
        {id: 'shortcuts', labelKey: 'settings.nav.shortcuts'},
        {id: 'plugins', labelKey: 'settings.nav.plugins'},
        {id: 'ai', labelKey: 'settings.nav.ai'},
        {id: 'about', labelKey: 'settings.nav.about'},
    ]
    return {
        id: 'settings',
        labelKey: 'app.titleBar.menu.settings',
        icon: 'settings',
        menuMode: 'dropdown',
        active: ctx.activeModule === 'settings',
        children: sections.map((section) =>
            leaf(`settings:${section.id}`, section.labelKey, () => h.openSettings(section.id), {
                active: ctx.activeModule === 'settings' && ctx.settingsSection === section.id,
                icon: settingsSectionIcon(section.id),
            }),
        ),
    }
}

/** 桌面顶栏：仅一级主导航；设置用下拉跳分区 */
export function buildTitleBarNav(ctx: TitleBarNavContext, handlers: TitleBarNavHandlers): TitleBarMenuItem[] {
    const menus: TitleBarMenuItem[] = [
        leaf('workbench', 'app.titleBar.menu.workbench', () => handlers.setModule('database'), {
            active: ctx.activeModule === 'database',
            icon: 'database',
        }),
        leaf('plugins', 'app.titleBar.menu.plugins', () => handlers.setModule('plugin'), {
            active: ctx.activeModule === 'plugin' || ctx.activeModule === 'pluginDev',
            icon: 'plugins',
            badge: ctx.presetConflictCount > 0 ? ctx.presetConflictCount : undefined,
        }),
    ]

    if (ctx.aiWorkbenchEnabled) {
        menus.push(
            leaf('ai', 'app.titleBar.menu.ai', () => handlers.setModule('ai'), {
                active: ctx.activeModule === 'ai',
                icon: 'ai',
            }),
        )
    }

    if (ctx.devToolsVisible) {
        const auditBadge = ctx.catalogIssueCount + ctx.presetConflictCount
        menus.push(
            leaf('devTools', 'app.titleBar.menu.devTools', () => handlers.openPluginDevTools(), {
                active: ctx.activeModule === 'pluginDev',
                icon: 'devTools',
                badge: auditBadge > 0 ? auditBadge : undefined,
            }),
        )
    }

    menus.push(
        leaf('dashboard', 'app.titleBar.menu.dashboard', () => handlers.setModule('dashboard'), {
            active: ctx.activeModule === 'dashboard',
            icon: 'dashboard',
        }),
        settingsMenu(ctx, handlers),
    )

    return menus
}

export function titleBarMenuActionableChildren(item: TitleBarMenuItem): TitleBarMenuItem[] {
    return item.children?.filter((child) => !child.divider && child.kind !== 'header') ?? []
}

export function titleBarMenuIsDropdown(item: TitleBarMenuItem): boolean {
    return item.menuMode === 'dropdown' && titleBarMenuActionableChildren(item).length > 0
}

export function titleBarMenuHasChildren(item: TitleBarMenuItem): boolean {
    return titleBarMenuIsDropdown(item)
}
