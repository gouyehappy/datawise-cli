import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {repairSshScriptRecords} from '@/features/ssh/services/ssh-builtin-defaults.service'

describe('ssh-builtin-defaults.service', () => {
    it('repairs blank builtin contentHtml', () => {
        const repaired = repairSshScriptRecords([
            {id: 'builtin-status', title: '状态', contentHtml: '', updatedAt: 1},
            {id: 'custom-1', title: 'Custom', contentHtml: '', updatedAt: 1},
        ])
        assert.ok(repaired[0]?.contentHtml?.includes('uptime'))
        assert.equal(repaired[1]?.contentHtml, '')
    })

    it('leaves non-empty builtins unchanged', () => {
        const html = '<pre>@run\necho keep</pre>'
        const repaired = repairSshScriptRecords([
            {id: 'builtin-logs', title: '日志', contentHtml: html, updatedAt: 1},
        ])
        assert.equal(repaired[0]?.contentHtml, html)
    })
})
