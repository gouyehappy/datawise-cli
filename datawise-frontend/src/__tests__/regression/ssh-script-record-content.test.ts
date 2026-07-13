import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {
    commandTextToRecordHtml,
    recordHtmlToCommandText,
} from '@/features/ssh/services/ssh-script-record-content.service'

describe('ssh-script-record-content.service', () => {
    it('round-trips plain command text through pre html', () => {
        const source = '# 查看应用列表\nyarn application -list'
        const html = commandTextToRecordHtml(source)
        assert.ok(html.includes('<pre>'))
        assert.equal(recordHtmlToCommandText(html), source)
    })

    it('reads legacy paragraph html', () => {
        const text = recordHtmlToCommandText('<p># 标题</p><p>uptime</p>')
        assert.ok(text.includes('# 标题'))
        assert.ok(text.includes('uptime'))
    })
})
