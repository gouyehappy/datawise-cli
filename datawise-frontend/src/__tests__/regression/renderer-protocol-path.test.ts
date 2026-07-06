import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {describe, it} from 'node:test'
import {resolveRendererDistFile} from '../../../electron/renderer-protocol-path'

describe('renderer protocol path', () => {
    it('resolves normal renderer assets within dist root', () => {
        const root = resolve('tmp-dist')

        assert.equal(resolveRendererDistFile(root, '/'), resolve(root, 'index.html'))
        assert.equal(resolveRendererDistFile(root, '/assets/app.js'), resolve(root, 'assets/app.js'))
    })

    it('rejects encoded path traversal outside dist root', () => {
        const root = resolve('tmp-dist')

        assert.equal(resolveRendererDistFile(root, '/%2e%2e/package.json'), null)
        assert.equal(resolveRendererDistFile(root, '/assets/%2e%2e/%2e%2e/package.json'), null)
    })

    it('rejects malformed encoded paths', () => {
        const root = resolve('tmp-dist')

        assert.equal(resolveRendererDistFile(root, '/%E0%A4%A'), null)
    })
})