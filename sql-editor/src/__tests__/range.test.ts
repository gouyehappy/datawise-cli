import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import type * as monaco from 'monaco-editor'
import {prefixAfterClauseKeyword, completionRange, completionPrefix} from '../completion/range.ts'
import {filterColumnsForCompletion} from '../completion/schema-column-index.ts'
import {analyzeSqlCompletionContextUncached} from '../completion/context.ts'

function mockModel(line: string, column: number): monaco.editor.ITextModel {
    return {
        getLineContent: () => line,
        getWordUntilPosition: () => ({
            word: '',
            startColumn: column,
            endColumn: column,
        }),
    } as monaco.editor.ITextModel
}

function mockPosition(column: number): monaco.Position {
    return {lineNumber: 1, column} as monaco.Position
}

describe('completion range — clause column prefix', () => {
    it('ON 完整后前缀为空，不会误匹配 description', () => {
        const line = 'SELECT * FROM t1 LEFT JOIN t2 ON'
        assert.equal(prefixAfterClauseKeyword(line, 'ON'), '')
        const cols = [
            {name: 'id'},
            {name: 'description'},
            {name: 'tag_name'},
        ]
        const filtered = filterColumnsForCompletion(cols, '')
        assert.equal(filtered.length, 3)
        const onPrefix = filterColumnsForCompletion(cols, 'on')
        assert.deepEqual(onPrefix.map((c) => c.name), [], 'prefix-only: on does not substring-match description')
        assert.equal(filterColumnsForCompletion(cols, prefixAfterClauseKeyword(line, 'ON')!).length, 3)
    })

    it('ON 后输入列前缀仍有效', () => {
        const line = 'SELECT * FROM t1 LEFT JOIN t2 ON ct.i'
        assert.equal(prefixAfterClauseKeyword(line, 'ON'), 'ct.i')
    })

    it('WHERE 完整后前缀为空', () => {
        assert.equal(prefixAfterClauseKeyword('SELECT * FROM t WHERE', 'WHERE'), '')
    })
})

describe('completion range — FROM qualified table', () => {
    it('hive. uses cursor insert range and empty prefix', () => {
        const sql = 'SELECT * FROM hive.'
        const ctx = analyzeSqlCompletionContextUncached(sql, sql.length, [], {})
        const model = mockModel(sql, sql.length + 1)
        const pos = mockPosition(sql.length + 1)
        const range = completionRange(model, pos, ctx)
        assert.deepEqual(range, {
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: pos.column,
            endColumn: pos.column,
        })
        assert.equal(completionPrefix(model, pos, ctx), '')
    })

    it('hive.a003.t replaces only table partial', () => {
        const sql = 'SELECT * FROM hive.a003.t'
        const ctx = analyzeSqlCompletionContextUncached(sql, sql.length, [], {})
        const model = mockModel(sql, sql.length + 1)
        const pos = mockPosition(sql.length + 1)
        const range = completionRange(model, pos, ctx)
        assert.deepEqual(range, {
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: pos.column - 1,
            endColumn: pos.column,
        })
        assert.equal(completionPrefix(model, pos, ctx), 't')
    })
})
