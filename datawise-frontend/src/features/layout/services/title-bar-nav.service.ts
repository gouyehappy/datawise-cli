import type {NavModule, SettingsSection} from '@/core/types'
import type {TitleBarMenuIconId} from '@/features/layout/components/TitleBarMenuIcon.vue'
import {
    buildQuickConfigMenuChildren,
    type TitleBarQuickConfigHandlers,
    type TitleBarQuickConfigState,
} from '@/features/layout/services/title-bar-config-menu.service'

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
    openOnboarding: () => void
    config: TitleBarQuickConfigHandlers
}

export interface TitleBarNavContext {
    activeModule: NavModule
    settingsSection: SettingsSection
    config: TitleBarQuickConfigState
}

const HELP_SECTIONS: SettingsSection[] = ['about']

type LeafOptions = Pick<TitleBarMenuItem, 'active' | 'badge' | 'icon'>

function leaf(
    id: string,
    labelKey: string,
    run: () => void,
    options: LeafOptions = {},
): TitleBarMenuItem {
    return {id, labelKey, kind: 'nav', run, ...options}
}

function configMenu(ctx: TitleBarNavContext, handlers: TitleBarNavHandlers): TitleBarMenuItem {
    return {
        id: 'config',
        labelKey: 'app.titleBar.menu.config',
        icon: 'config',
        menuMode: 'dropdown',
        children: buildQuickConfigMenuChildren(ctx.config, handlers.config),
    }
}

function helpMenu(ctx: TitleBarNavContext, handlers: TitleBarNavHandlers): TitleBarMenuItem {
    return {
        id: 'help',
        labelKey: 'app.titleBar.menu.help',
        icon: 'help',
        menuMode: 'dropdown',
        active: ctx.activeModule === 'settings' && HELP_SECTIONS.includes(ctx.settingsSection),
        children: [
            leaf('help:onboarding', 'app.titleBar.menu.helpOnboarding', () => handlers.openOnboarding(), {
                icon: 'open',
            }),
            leaf('help:about', 'settings.nav.about', () => handlers.openSettings('about'), {
                active: ctx.activeModule === 'settings' && ctx.settingsSection === 'about',
                icon: 'about',
            }),
        ],
    }
}

/** 桌面顶栏：工作台、仪表盘、AI、配置、帮助 */
export function buildTitleBarNav(ctx: TitleBarNavContext, handlers: TitleBarNavHandlers): TitleBarMenuItem[] {
    return [
        leaf('workbench', 'app.titleBar.menu.workbench', () => handlers.setModule('database'), {
            active: ctx.activeModule === 'database',
            icon: 'database',
        }),
        leaf('dashboard', 'app.titleBar.menu.dashboard', () => handlers.setModule('dashboard'), {
            active: ctx.activeModule === 'dashboard',
            icon: 'dashboard',
        }),
        leaf('ai', 'app.titleBar.menu.ai', () => handlers.setModule('ai'), {
            active: ctx.activeModule === 'ai',
            icon: 'ai',
        }),
        configMenu(ctx, handlers),
        helpMenu(ctx, handlers),
    ]
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
