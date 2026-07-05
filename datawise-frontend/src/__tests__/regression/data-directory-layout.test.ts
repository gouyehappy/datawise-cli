import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {resolveDataDirectoryLayout} from '@/shared/config/data-directory-layout'

describe('resolveDataDirectoryLayout', () => {
    it('derives fixed subfolders from data root', () => {
        const layout = resolveDataDirectoryLayout('C:\\DataWise\\config')

        assert.equal(layout.root, 'C:\\DataWise\\config')
        assert.equal(layout.entries.find((entry) => entry.id === 'scripts')?.resolved, 'C:\\DataWise\\config\\scripts')
        assert.equal(layout.entries.find((entry) => entry.id === 'logs')?.resolved, 'C:\\DataWise\\config\\logs')
    })

    it('uses health scripts path when provided', () => {
        const layout = resolveDataDirectoryLayout('/data/config', '/project/sql')

        assert.equal(layout.entries.find((entry) => entry.id === 'scripts')?.resolved, '/project/sql')
    })
})
