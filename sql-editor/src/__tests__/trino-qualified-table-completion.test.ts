import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {parseTableAliases} from '../utils/parse-references.ts'
import {analyzeSqlCompletionContextUncached, tablesReferencedInQuery} from '../completion/context.ts'
import {resolveCompletionPlan} from '../completion/grammar/index.ts'
import {resolveCompletionKeywords} from '../completion/plan-keywords.ts'
import {setActiveSqlEditorRuntime, createSqlEditorRuntime} from '../runtime/sql-editor-runtime.ts'
import {toPlainSqlEditorSchema} from '../utils/schema-plain.ts'
import {collectColumnSuggestions} from '../completion/builders/column-collectors.ts'
import type {SqlEditorSchema} from '../types.ts'

describe('trino qualified table completion', () => {
    const tables = ['test']
    const columns = {
        test: [{name: 'id'}, {name: 'name'}, {name: 'created_at'}],
    }
    const schema: SqlEditorSchema = {tables, columns}

    it('parseTableAliases maps alias to short table name', () => {
        const aliases = parseTableAliases(
            'SELECT * FROM hive.a003.test t WHERE t.id = 1',
            tables,
        )
        assert.equal(aliases.t, 'test')
        assert.equal(aliases.test, 'test')
    })

    it('after table+alias suggests WHERE', () => {
        const sql = 'SELECT * FROM hive.a003.test t '
        const ctx = analyzeSqlCompletionContextUncached(sql, sql.length, tables, columns)
        const plan = resolveCompletionPlan(ctx)
        const keywords = resolveCompletionKeywords(ctx, plan)
        assert.ok(keywords.some((kw) => kw.toUpperCase() === 'WHERE'))
        assert.equal(ctx.fromJoin?.tableClauseComplete, true)
    })

    it('alias dot resolves table and suggests columns via runtime schema', () => {
        const runtime = createSqlEditorRuntime({sync: false})
        runtime.setSchema(toPlainSqlEditorSchema(schema))
        setActiveSqlEditorRuntime(runtime, {sync: false})

        const sql = 'SELECT * FROM hive.a003.test t WHERE t.'
        const ctx = analyzeSqlCompletionContextUncached(sql, sql.length, tables, columns)
        assert.equal(ctx.slot, 'column_ref')
        assert.equal(ctx.qualifier, 't')
        assert.equal(ctx.resolvedTable, 'test')

        const items: Array<{ insertText: string }> = []
        collectColumnSuggestions(
            ctx,
            (item) => items.push(item),
            {startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 1},
            '',
            true,
        )
        assert.deepEqual(items.map((item) => item.insertText).sort(), ['created_at', 'id', 'name'])
    })

    it('WHERE slot keeps alias mapping for column loading', () => {
        const sql = 'SELECT * FROM hive.a003.test t WHERE '
        const ctx = analyzeSqlCompletionContextUncached(sql, sql.length, tables, columns)
        assert.equal(ctx.slot, 'where')
        assert.equal(ctx.aliases.t, 'test')
        assert.deepEqual(tablesReferencedInQuery(ctx), ['test'])
    })
})
