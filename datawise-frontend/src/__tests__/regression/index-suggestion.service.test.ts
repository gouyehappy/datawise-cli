import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {
    buildHeuristicIndexDrafts,
    extractFilterColumnsForTable,
    formatIndexDraftSql,
    mergeAiIndexDraftSql,
} from '@/features/workspace/services/index-suggestion.service'

describe('index-suggestion.service', () => {
    it('extracts filter columns from WHERE clause', () => {
        const columns = extractFilterColumnsForTable(
            'SELECT * FROM orders o WHERE o.status = 1 AND user_id = 2 ORDER BY created_at',
            'orders',
        )
        assert.ok(columns.includes('status'))
        assert.ok(columns.includes('user_id') || columns.includes('created_at'))
    })

    it('builds drafts from explain plan full scan', () => {
        const drafts = buildHeuristicIndexDrafts(
            [{
                id: '1',
                label: 'orders (ALL)',
                metrics: {type: 'ALL', table: 'orders'},
            }],
            'SELECT * FROM orders WHERE status = 1',
            'mysql',
        )
        assert.equal(drafts.length, 1)
        assert.equal(drafts[0].table, 'orders')
        assert.ok(drafts[0].columns.length)
    })

    it('formats create index sql with comments', () => {
        const sql = formatIndexDraftSql([
            {
                table: 'orders',
                indexName: 'idx_orders_status',
                columns: ['status'],
                reason: 'Avoid full scan',
            },
        ], 'mysql', 'shop')
        assert.match(sql, /CREATE INDEX/)
        assert.match(sql, /Avoid full scan/)
        assert.match(sql, /`shop`\.`orders`/)
    })

    it('merges ai response keeping create index statements', () => {
        const merged = mergeAiIndexDraftSql(
            'Here you go:\nCREATE INDEX idx_users_email ON users (email);\n',
            '-- fallback\n',
        )
        assert.match(merged, /CREATE INDEX idx_users_email/)
    })
})
