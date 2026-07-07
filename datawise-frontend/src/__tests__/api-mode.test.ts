import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {DEFAULT_DESKTOP_API_BASE, readApiBaseUrl} from '@/shared/api/mode'
import {BACKEND_PACKAGED_PORT, FRONTEND_DEV_PORT} from '@/shared/config/runtime-ports'

describe('readApiBaseUrl', () => {
    it('uses packaged backend port for file protocol default', () => {
        assert.equal(DEFAULT_DESKTOP_API_BASE, `http://127.0.0.1:${BACKEND_PACKAGED_PORT}`)
    })

    it('uses desktop default when loaded from file protocol', () => {
        const previous = globalThis.window
        ;(globalThis as typeof globalThis & {window: Window}).window = {
            location: {protocol: 'file:', origin: 'file://'},
        } as Window

        assert.equal(readApiBaseUrl(), DEFAULT_DESKTOP_API_BASE)

        globalThis.window = previous
    })

    it('uses desktop default when loaded from app protocol', () => {
        const previous = globalThis.window
        ;(globalThis as typeof globalThis & {window: Window}).window = {
            location: {protocol: 'app:', origin: 'app://local'},
        } as Window

        assert.equal(readApiBaseUrl(), DEFAULT_DESKTOP_API_BASE)

        globalThis.window = previous
    })

    it('prefers injected desktop api base url from bridge before compose', () => {
        const previous = globalThis.window
        ;(globalThis as typeof globalThis & {window: Window}).window = {
            __datawiseDesktopBridge: {platform: 'win32', apiBaseUrl: 'http://127.0.0.1:9090'},
        } as Window

        assert.equal(readApiBaseUrl(), 'http://127.0.0.1:9090')

        globalThis.window = previous
    })

    it('prefers injected desktop api base url', () => {
        const previous = globalThis.window
        ;(globalThis as typeof globalThis & {window: Window}).window = {
            location: {protocol: 'file:', origin: 'file://'},
            datawise: {platform: 'win32', apiBaseUrl: 'http://127.0.0.1:9090'},
        } as Window

        assert.equal(readApiBaseUrl(), 'http://127.0.0.1:9090')

        globalThis.window = previous
    })

    it('returns empty for http dev origin without configured base', () => {
        const previous = globalThis.window
        ;(globalThis as typeof globalThis & {window: Window}).window = {
            location: {protocol: 'http:', origin: `http://localhost:${FRONTEND_DEV_PORT}`},
        } as Window

        assert.equal(readApiBaseUrl(), '')

        globalThis.window = previous
    })
})
