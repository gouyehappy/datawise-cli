import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
    buildTitleBarNav,
    titleBarMenuHasChildren,
} from '@/features/layout/services/title-bar-nav.service'

const noopHandlers = {
    setModule: () => {},
    openSettings: () => {},
    openPluginDevTools: () => {},
    openConnectorMarket: () => {},
}

describe('title-bar-nav.service', () => {
    it('builds primary nav with settings sections dropdown only', () => {
        const calls: string[] = []
        const menus = buildTitleBarNav(
            {
                activeModule: 'settings',
                settingsSection: 'layout',
                devToolsVisible: true,
                presetConflictCount: 1,
                catalogIssueCount: 2,
                aiWorkbenchEnabled: true,
            },
            {
                ...noopHandlers,
                openSettings: (s) => calls.push(`settings:${s ?? 'basic'}`),
            },
        )

        assert.equal(menus.length, 7)
        assert.ok(menus.every((item) => item.id !== 'tools'))
        assert.ok(!menus.some((item) => item.menuMode === 'linked'))

        const settings = menus.find((item) => item.id === 'settings')
        assert.ok(settings && titleBarMenuHasChildren(settings))
        assert.ok(!settings!.children!.some((item) => item.kind === 'action'))
        assert.ok(!settings!.children!.some((item) => item.kind === 'header'))

        const layoutChild = settings!.children!.find((item) => item.id === 'settings:layout')
        assert.equal(layoutChild?.active, true)

        layoutChild?.run?.()
        assert.deepEqual(calls, ['settings:layout'])
    })

    it('shows preset conflict badge on plugins entry', () => {
        const menus = buildTitleBarNav(
            {
                activeModule: 'plugin',
                settingsSection: 'basic',
                devToolsVisible: false,
                presetConflictCount: 3,
                catalogIssueCount: 0,
                aiWorkbenchEnabled: false,
            },
            noopHandlers,
        )

        const plugins = menus.find((item) => item.id === 'plugins')
        assert.equal(plugins?.badge, 3)
        assert.ok(!menus.some((item) => item.id === 'devTools'))
    })

    it('omits dev tools when entry hidden', () => {
        const menus = buildTitleBarNav(
            {
                activeModule: 'database',
                settingsSection: 'basic',
                devToolsVisible: false,
                presetConflictCount: 0,
                catalogIssueCount: 0,
                aiWorkbenchEnabled: false,
            },
            noopHandlers,
        )

        assert.equal(menus.length, 5)
        assert.ok(!menus.some((item) => item.id === 'devTools'))
        assert.ok(!menus.some((item) => item.id === 'ai'))
    })
})
