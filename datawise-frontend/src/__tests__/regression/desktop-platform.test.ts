import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {describeDesktopTarget, resolveElectronBuilderArgs} from '../../../scripts/desktop/platform.mjs'

describe('desktop platform.mjs', () => {
    it('defaults to win on win32', () => {
        assert.deepEqual(
            resolveElectronBuilderArgs({platform: 'win32'}),
            ['--win'],
        )
    })

    it('defaults to mac arm64 on darwin arm64 host', () => {
        const args = resolveElectronBuilderArgs({platform: 'darwin'})
        assert.ok(args.includes('--mac'))
        if (process.arch === 'arm64') {
            assert.ok(args.includes('--arm64'))
        }
    })

    it('rejects mac packaging on Windows unless override', () => {
        assert.throws(
            () => resolveElectronBuilderArgs({mac: true, platform: 'win32', allowCross: false}),
            /requires macOS/,
        )
    })

    it('allows cross packaging with override', () => {
        const args = resolveElectronBuilderArgs({mac: true, platform: 'win32', allowCross: true, arm64: true})
        assert.deepEqual(args, ['--mac', '--arm64'])
    })

    it('describes targets', () => {
        assert.equal(describeDesktopTarget(['--mac', '--arm64']), 'mac arm64 (installer)')
        assert.equal(describeDesktopTarget(['--win', '--dir']), 'win default (unpacked)')
    })
})
