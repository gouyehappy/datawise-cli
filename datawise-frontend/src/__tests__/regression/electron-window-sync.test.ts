import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {reactive} from 'vue'

import {toWindowStatePayload} from '@/features/layout/services/electron-window-state.service'

describe('electron window sync', () => {
    it('converts reactive window preferences to a structured-clone-safe payload', () => {
        const windowPrefs = reactive({
            width: 1280,
            height: 820,
            x: Number.NaN,
            y: 24,
            maximized: false,
        })

        const payload = toWindowStatePayload(windowPrefs)

        assert.deepEqual(payload, {
            width: 1280,
            height: 820,
            x: null,
            y: 24,
            maximized: false,
        })
        assert.doesNotThrow(() => structuredClone(payload))
    })
})