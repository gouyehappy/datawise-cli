import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {htmlToPlainText} from '@/features/ssh/services/ssh-html-text.service'
import {
    filterMyCommandGroups,
    isBuiltInScriptRecordId,
    parseCommandEntries,
    parseMyCommandGroups,
    sortMyCommandGroups,
    summarizeCommandLabel,
} from '@/features/ssh/services/ssh-my-commands.service'

describe('ssh-html-text.service', () => {
    it('preserves line breaks from paragraph html', () => {
        const text = htmlToPlainText('<p># 服务器地址</p><p>51</p><p>yarn application -list</p>')
        assert.ok(text.includes('\n'))
        assert.ok(text.includes('# 服务器地址'))
        assert.ok(text.includes('yarn application -list'))
    })
})

describe('ssh-my-commands.service', () => {
    it('parses hash labels with following command lines', () => {
        const parsed = parseCommandEntries(`# 服务器地址
51
# 查看应用列表
yarn application -list`)
        assert.equal(parsed.entries.length, 2)
        assert.equal(parsed.entries[0]?.label, '服务器地址')
        assert.equal(parsed.entries[0]?.command, '51')
        assert.equal(parsed.entries[1]?.label, '查看应用列表')
        assert.equal(parsed.entries[1]?.command, 'yarn application -list')
        assert.equal(parsed.mode, 'paste')
    })

    it('parses @run mode and entry-level overrides', () => {
        const parsed = parseCommandEntries(`@run
# 磁盘
df -h
# 自定义 !paste
echo hello`)
        assert.equal(parsed.mode, 'run')
        assert.equal(parsed.entries[0]?.command, 'df -h')
        assert.equal(parsed.entries[1]?.mode, 'paste')
    })

    it('marks multi-entry records as groups and built-in ids', () => {
        const groups = parseMyCommandGroups([
            {
                id: 'builtin-status',
                title: '状态',
                contentHtml: '<pre>@run\n# 磁盘\ndf -h</pre>',
                updatedAt: 0,
            },
            {
                id: 'r1',
                title: 'YARN',
                contentHtml: '<p># 查看应用列表</p><p>yarn application -list</p><p># 节点列表</p><p>yarn node -list -all</p>',
                updatedAt: 0,
            },
        ], 'Untitled')

        assert.equal(groups.length, 2)
        assert.equal(groups[0]?.builtIn, true)
        assert.equal(groups[0]?.mode, 'run')
        assert.equal(groups[1]?.multi, true)
        assert.equal(groups[1]?.entries.length, 2)
    })

    it('sorts pinned and built-in groups first', () => {
        const sorted = sortMyCommandGroups([
            {
                id: 'custom',
                title: 'Custom',
                entries: [{label: 'a', command: 'a'}],
                multi: false,
                mode: 'paste',
                builtIn: false,
                pinned: false,
            },
            {
                id: 'builtin-logs',
                title: 'Logs',
                entries: [{label: 'a', command: 'a'}],
                multi: false,
                mode: 'run',
                builtIn: true,
                pinned: false,
            },
            {
                id: 'pinned',
                title: 'Pinned',
                entries: [{label: 'a', command: 'a'}],
                multi: false,
                mode: 'paste',
                builtIn: false,
                pinned: true,
            },
        ])
        assert.equal(sorted[0]?.id, 'pinned')
        assert.equal(sorted[1]?.id, 'builtin-logs')
    })

    it('filters groups by title, label, and command', () => {
        const groups = parseMyCommandGroups([
            {
                id: 'r1',
                title: 'YARN',
                contentHtml: '<pre># 查看应用\nyarn application -list</pre>',
                updatedAt: 0,
            },
        ], 'Untitled')
        const filtered = filterMyCommandGroups(groups, 'application')
        assert.equal(filtered.length, 1)
        assert.equal(filtered[0]?.entries.length, 1)
    })

    it('summarizes long command labels', () => {
        const label = summarizeCommandLabel('yarn application -list -appStates RUNNING,ACCEPTED', 20)
        assert.ok(label.endsWith('…'))
        assert.ok(label.length <= 20)
    })

    it('detects built-in record ids', () => {
        assert.equal(isBuiltInScriptRecordId('builtin-logs'), true)
        assert.equal(isBuiltInScriptRecordId('custom-1'), false)
    })
})
