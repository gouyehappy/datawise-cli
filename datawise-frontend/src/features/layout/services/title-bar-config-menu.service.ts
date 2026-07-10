import type {TitleBarMenuIconId} from '@/features/layout/components/TitleBarMenuIcon.vue'
import type {TitleBarMenuItem} from '@/features/layout/services/title-bar-nav.service'

export interface TitleBarQuickConfigState {
    showSideRailStrip: boolean
    showExplorerPanel: boolean
    showShortcutRailStrip: boolean
}

export interface TitleBarQuickConfigHandlers {
    openPreferences: () => void
    toggleSideRailStrip: () => void
    toggleExplorerPanel: () => void
    toggleShortcutRailStrip: () => void
    applyFocusMode: () => void
}

type ToggleOptions = {
    icon: TitleBarMenuIconId
    labelOnKey: string
    labelOffKey: string
}

function toggleItem(
    id: string,
    enabled: boolean,
    run: () => void,
    options: ToggleOptions,
): TitleBarMenuItem {
    return {
        id,
        labelKey: enabled ? options.labelOnKey : options.labelOffKey,
        kind: 'action',
        checked: enabled,
        icon: options.icon,
        run,
    }
}

function divider(id: string): TitleBarMenuItem {
    return {id, labelKey: '', divider: true}
}

/** 配置菜单：首选项 + 少量面板开关 + 专注模式 */
export function buildQuickConfigMenuChildren(
    state: TitleBarQuickConfigState,
    handlers: TitleBarQuickConfigHandlers,
): TitleBarMenuItem[] {
    return [
        {
            id: 'config:preferences',
            labelKey: 'app.titleBar.menu.configQuick.preferences',
            kind: 'action',
            icon: 'settings',
            run: handlers.openPreferences,
        },
        divider('config:divider-panels'),
        toggleItem('config:side-rail', state.showSideRailStrip, handlers.toggleSideRailStrip, {
            icon: 'layout',
            labelOnKey: 'app.titleBar.menu.configQuick.hideNavBar',
            labelOffKey: 'app.titleBar.menu.configQuick.showNavBar',
        }),
        toggleItem('config:explorer', state.showExplorerPanel, handlers.toggleExplorerPanel, {
            icon: 'tree',
            labelOnKey: 'app.titleBar.menu.configQuick.hideToolbar',
            labelOffKey: 'app.titleBar.menu.configQuick.showToolbar',
        }),
        toggleItem('config:shortcut-rail', state.showShortcutRailStrip, handlers.toggleShortcutRailStrip, {
            icon: 'shortcuts',
            labelOnKey: 'app.titleBar.menu.configQuick.hideRightSidebar',
            labelOffKey: 'app.titleBar.menu.configQuick.showRightSidebar',
        }),
        divider('config:divider-focus'),
        {
            id: 'config:focus-mode',
            labelKey: 'app.titleBar.menu.configQuick.focusMode',
            kind: 'action',
            icon: 'console',
            run: handlers.applyFocusMode,
        },
    ]
}
