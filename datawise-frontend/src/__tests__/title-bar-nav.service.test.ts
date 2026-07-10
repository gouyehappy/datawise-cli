import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {buildQuickConfigMenuChildren} from '@/features/layout/services/title-bar-config-menu.service'
import {
    buildTitleBarNav,
    titleBarMenuHasChildren,
} from '@/features/layout/services/title-bar-nav.service'

const defaultConfigState = {
    showSideRailStrip: true,
    showExplorerPanel: true,
    showShortcutRailStrip: true,
}

const noopConfigHandlers = {
    openPreferences: () => {},
    toggleSideRailStrip: () => {},
    toggleExplorerPanel: () => {},
    toggleShortcutRailStrip: () => {},
    applyFocusMode: () => {},
}

const noopHandlers = {
    setModule: () => {},
    openSettings: () => {},
    openOnboarding: () => {},
    config: noopConfigHandlers,
}

describe('title-bar-config-menu.service', () => {
    it('builds a compact config menu with preferences, panel toggles, and focus mode', () => {
        const items = buildQuickConfigMenuChildren(defaultConfigState, noopConfigHandlers)
        const actionable = items.filter((item) => !item.divider)

        assert.deepEqual(
            actionable.map((item) => item.id),
            [
                'config:preferences',
                'config:side-rail',
                'config:explorer',
                'config:shortcut-rail',
                'config:focus-mode',
            ],
        )

        const explorer = items.find((item) => item.id === 'config:explorer')
        assert.equal(explorer?.labelKey, 'app.titleBar.menu.configQuick.hideToolbar')
        assert.equal(explorer?.checked, true)
    })
})

describe('title-bar-nav.service', () => {
    it('builds simplified primary nav with quick config menu', () => {
        const calls: string[] = []
        const menus = buildTitleBarNav(
            {
                activeModule: 'database',
                settingsSection: 'basic',
                config: defaultConfigState,
            },
            {
                ...noopHandlers,
                config: {
                    ...noopConfigHandlers,
                    openPreferences: () => calls.push('open-settings'),
                },
            },
        )

        assert.deepEqual(
            menus.map((item) => item.id),
            ['workbench', 'dashboard', 'ai', 'config', 'help'],
        )

        const config = menus.find((item) => item.id === 'config')
        assert.ok(config && titleBarMenuHasChildren(config))
        assert.ok(config!.children!.some((item) => item.id === 'config:preferences'))
        assert.ok(config!.children!.some((item) => item.id === 'config:focus-mode'))
        assert.ok(!config!.children!.some((item) => item.id === 'config:terminal'))
        assert.equal(config?.active, undefined)

        config!.children!.find((item) => item.id === 'config:preferences')?.run?.()
        assert.deepEqual(calls, ['open-settings'])
    })

    it('marks help menu active on about section', () => {
        const menus = buildTitleBarNav(
            {
                activeModule: 'settings',
                settingsSection: 'about',
                config: defaultConfigState,
            },
            noopHandlers,
        )

        const help = menus.find((item) => item.id === 'help')
        assert.equal(help?.active, true)
    })
})
