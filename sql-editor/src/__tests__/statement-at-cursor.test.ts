import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {resolveStatementAtCursor} from '../utils/statement-at-cursor.ts'

describe('resolveStatementAtCursor', () => {
    it('returns multi-line statement when cursor is on FROM line', () => {
        const sql = 'SELECT *\nFROM cdp_segment t1;'
        const cursor = sql.indexOf('FROM') + 2
        const result = resolveStatementAtCursor(sql, cursor)
        assert.equal(result?.sql, 'SELECT *\nFROM cdp_segment t1')
        assert.equal(result?.startLine, 1)
        assert.equal(result?.endLine, 2)
        assert.equal(result?.anchorLine, 1)
    })

    it('returns only the statement that contains the cursor', () => {
        const sql = 'SELECT 1;\nSELECT 2'
        const cursor = sql.indexOf('2')
        const result = resolveStatementAtCursor(sql, cursor)
        assert.equal(result?.sql, 'SELECT 2')
        assert.equal(result?.startLine, 2)
    })

    it('ignores semicolons inside string literals', () => {
        const sql = "SELECT ';' AS x FROM t"
        const cursor = sql.indexOf('FROM') + 1
        const result = resolveStatementAtCursor(sql, cursor)
        assert.equal(result?.sql, sql)
    })

    it('returns null between statements on blank lines', () => {
        const sql = 'SELECT 1;\n\nSELECT 2'
        const cursor = sql.indexOf('\n\n') + 1
        const result = resolveStatementAtCursor(sql, cursor)
        assert.equal(result, null)
    })

    it('returns null for comment-only lines outside statements', () => {
        const sql = '-- note\nSELECT 1'
        const cursor = 1
        const result = resolveStatementAtCursor(sql, cursor)
        assert.equal(result, null)
    })
})
