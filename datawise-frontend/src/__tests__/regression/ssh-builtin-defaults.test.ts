import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {repairSshScriptRecords} from '@/features/ssh/services/ssh-builtin-defaults.service'

describe('ssh-builtin-defaults.service', () => {
    it('repairs blank builtin contentHtml', () => {
        const repaired = repairSshScriptRecords([
            {id: 'builtin-status', title: '状态', contentHtml: '', updatedAt: 1},
            {id: 'custom-1', title: 'Custom', contentHtml: '', updatedAt: 1},
        ])
        const status = repaired.find((item) => item.id === 'builtin-status')
        assert.ok(status?.contentHtml?.includes('uptime'))
        assert.equal(repaired.find((item) => item.id === 'custom-1')?.contentHtml, '')
        assert.ok(repaired.some((item) => item.id === 'builtin-mongodb'))
        assert.ok(repaired.some((item) => item.id === 'builtin-common'))
    })

    it('leaves non-empty builtins unchanged but appends missing ids', () => {
        const html = '<pre>@run\necho keep</pre>'
        const repaired = repairSshScriptRecords([
            {id: 'builtin-logs', title: '日志', contentHtml: html, updatedAt: 1},
        ])
        assert.equal(repaired.find((item) => item.id === 'builtin-logs')?.contentHtml, html)
        assert.ok(repaired.some((item) => item.id === 'builtin-yarn'))
        assert.ok(repaired.some((item) => item.id === 'builtin-kafka'))
        assert.ok(repaired.some((item) => item.id === 'builtin-mongodb'))
    })
})
