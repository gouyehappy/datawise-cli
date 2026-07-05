import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {installPluginHookHost} from '@/features/plugin/services/plugin-hook-host'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'

describe('installPluginHookHost', () => {
    it('composes window.datawise from read-only desktop bridge', () => {
        const previousBridge = globalThis.window?.__datawiseDesktopBridge
        const previousDatawise = globalThis.window?.datawise

        ;(globalThis as typeof globalThis & {window: Window}).window = {
            __datawiseDesktopBridge: {
                platform: 'win32',
                apiBaseUrl: 'http://127.0.0.1:18421',
            },
        } as Window

        installPluginHookHost()

        assert.equal(isDesktopApp(), true)
        assert.equal(globalThis.window.datawise?.platform, 'win32')
        assert.equal(typeof globalThis.window.datawise?.registerPluginHooks, 'function')
        assert.equal(typeof globalThis.window.datawise?.unregisterPluginHooks, 'function')

        globalThis.window.__datawiseDesktopBridge = previousBridge
        globalThis.window.datawise = previousDatawise
    })
})
