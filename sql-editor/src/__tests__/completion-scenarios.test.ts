/**
 * 补全场景矩阵 — 验证「合适的位置给合适的提示」
 * 不依赖 Monaco，只测 context + plan + guards。
 */
import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {analyzeSqlCompletionContext} from '../completion/context.ts'
import {resolveCompletionPlan} from '../completion/grammar/index.ts'
import {
    allowsEmptyPrefixCompletion,
    shouldAbortCompletion,
} from '../completion/policy/guards.ts'
import {shouldOfferKeywordAtCursor} from '../completion/completed-keyword.ts'
import {matchesKeywordPrefix} from '../completion/filter-text.ts'

const Invoke = 0
const TriggerCharacter = 1

const TABLES = ['orders', 'order_items', 'users', 'items', 'cdp_segment']
const COLUMNS = {
    orders: [{name: 'id'}, {name: 'amount'}],
    order_items: [{name: 'id'}],
    users: [{name: 'id', pk: true}, {name: 'status'}],
    orders: [{name: 'id'}, {name: 'user_id'}],
    items: [{name: 'user_id'}],
    cdp_segment: [{name: 'id'}, {name: 'tag_ids'}],
}

type Expect = {
    slot?: string
    abort?: boolean
    allowEmpty?: boolean
    awaitingJoinTable?: boolean
    awaitingTableName?: boolean
    awaitingOnClause?: boolean
    tableClauseComplete?: boolean
    joinKeywordPrefix?: string | null
    aliasAfterCursor?: string | null
    afterTable?: boolean
    tablesFirst?: boolean
    hasTables?: boolean
    hasKeywords?: boolean
    hasFkJoinLines?: boolean
    hasSnippets?: boolean
    stage?: string
    columnRef?: boolean
    afterPredicate?: boolean
    afterCompleteCol?: boolean
}

function at(sql: string, marker = '|') {
    const offset = sql.indexOf(marker)
    assert.ok(offset >= 0, `marker not found in: ${sql}`)
    const clean = sql.replace(marker, '')
    const ctx = analyzeSqlCompletionContext(clean, offset, TABLES, COLUMNS)
    const plan = resolveCompletionPlan(ctx)
    const prefix =
        ctx.fromJoin?.joinKeywordPrefix ??
        ctx.fromJoin?.tablePrefix ??
        (ctx.columnPrefix ?? '')
    return {ctx, plan, clean, offset, prefix}
}

function assertScenario(label: string, sql: string, exp: Expect) {
    const {ctx, plan, clean, offset, prefix} = at(sql)
    if (exp.slot !== undefined) assert.equal(ctx.slot, exp.slot, `${label}: slot`)
    if (exp.awaitingJoinTable !== undefined) {
        assert.equal(ctx.fromJoin?.awaitingJoinTable, exp.awaitingJoinTable, `${label}: awaitingJoinTable`)
    }
    if (exp.awaitingOnClause !== undefined) {
        assert.equal(ctx.fromJoin?.awaitingOnClause, exp.awaitingOnClause, `${label}: awaitingOnClause`)
    }
    if (exp.tableClauseComplete !== undefined) {
        assert.equal(ctx.fromJoin?.tableClauseComplete, exp.tableClauseComplete, `${label}: tableClauseComplete`)
    }
    if (exp.joinKeywordPrefix !== undefined) {
        assert.equal(ctx.fromJoin?.joinKeywordPrefix ?? null, exp.joinKeywordPrefix, `${label}: joinKeywordPrefix`)
    }
    if (exp.aliasAfterCursor !== undefined) {
        assert.equal(ctx.fromJoin?.aliasOnLineAfterCursor ?? null, exp.aliasAfterCursor, `${label}: aliasAfterCursor`)
    }
    if (exp.afterTable !== undefined) {
        assert.equal(plan.keywordSlot === 'after_table', exp.afterTable, `${label}: afterTable plan`)
    }
    if (exp.tablesFirst !== undefined) {
        const hasTables = plan.collectors.includes('tables') && !plan.suppressTables
        const hasKw = plan.collectors.includes('keywords')
        if (exp.tablesFirst) {
            assert.ok(hasTables, `${label}: expected tables in plan`)
            assert.ok(plan.sortProfile === 'table-first' || !hasKw, `${label}: tables should beat keywords`)
            assert.equal(plan.suppressTables, false, `${label}: suppressTables`)
        }
    }
    if (exp.hasTables !== undefined) {
        const hasTables = plan.collectors.includes('tables') && !plan.suppressTables
        assert.equal(hasTables, exp.hasTables, `${label}: hasTables`)
    }
    if (exp.hasKeywords !== undefined) {
        assert.equal(plan.collectors.includes('keywords'), exp.hasKeywords, `${label}: hasKeywords`)
    }
    if (exp.hasFkJoinLines !== undefined) {
        assert.equal(plan.collectors.includes('fkJoinLines'), exp.hasFkJoinLines, `${label}: hasFkJoinLines`)
    }
    if (exp.hasSnippets !== undefined) {
        assert.equal(plan.collectors.includes('snippets'), exp.hasSnippets, `${label}: hasSnippets`)
    }
    if (exp.stage !== undefined) {
        assert.equal(plan.stage, exp.stage, `${label}: stage`)
    }
    if (exp.columnRef !== undefined) {
        assert.equal(ctx.slot === 'column_ref', exp.columnRef, `${label}: columnRef`)
    }
    if (exp.afterPredicate !== undefined) {
        assert.equal(ctx.signals.after_predicate_operator, exp.afterPredicate, `${label}: afterPredicate`)
    }
    if (exp.afterCompleteCol !== undefined) {
        assert.equal(ctx.signals.after_complete_column_ref, exp.afterCompleteCol, `${label}: afterCompleteCol`)
    }
    if (exp.allowEmpty !== undefined) {
        assert.equal(allowsEmptyPrefixCompletion(ctx), exp.allowEmpty, `${label}: allowEmpty`)
    }
    if (exp.abort !== undefined) {
        const aborted = shouldAbortCompletion({
            sql: clean,
            offset,
            prefix: prefix || '',
            ctx,
            triggerKind: TriggerCharacter,
        })
        assert.equal(aborted, exp.abort, `${label}: abort`)
    }
}

describe('completion scenarios — FROM / JOIN chain', () => {
    it('FROM 空：表名补全（不重复 FROM 关键字）', () => {
        assertScenario('from-empty', 'SELECT * FROM |', {
            slot: 'from',
            awaitingTableName: true,
            hasTables: true,
            hasKeywords: false,
            allowEmpty: true,
            abort: false,
        })
    })

    it('多行 SELECT * FROM 后：空格再出表名', () => {
        assertScenario('multiline-from-space', 'SELECT\n*\nFROM |', {
            slot: 'from',
            awaitingTableName: true,
            hasTables: true,
            hasKeywords: false,
            allowEmpty: true,
            abort: false,
        })
    })

    it('FROM 刚输完无空格：不自动弹表名', () => {
        assertScenario('from-no-trailing-space', 'SELECT * FROM|', {
            awaitingTableName: false,
            allowEmpty: false,
            abort: true,
        })
    })

    it('多行 FROM 无空格：不自动弹表名', () => {
        assertScenario('multiline-from', 'SELECT\n*\nFROM|', {
            slot: 'from',
            awaitingTableName: false,
            allowEmpty: false,
            abort: true,
        })
    })

    it('FROM 表前缀：仍补表', () => {
        assertScenario('from-prefix', 'SELECT * FROM ord|', {
            slot: 'from',
            hasTables: true,
            abort: false,
        })
    })

    it('FROM 表名未完整 + 别名在后：仍补表', () => {
        assertScenario('from-partial-alias-ahead', 'SELECT * FROM ord| t1', {
            aliasAfterCursor: 't1',
            tableClauseComplete: false,
            hasTables: true,
            abort: false,
        })
    })

    it('FROM 表名完整 + 别名在后：自动触发中止', () => {
        assertScenario('from-complete-alias-ahead', 'SELECT * FROM orders| t1', {
            aliasAfterCursor: 't1',
            tableClauseComplete: true,
            abort: true,
        })
    })

    it('FROM 表+别名后：WHERE/JOIN 关键字', () => {
        assertScenario('after-from-table', 'SELECT * FROM orders t1|', {
            tableClauseComplete: true,
            afterTable: true,
            hasKeywords: true,
            hasFkJoinLines: true,
            hasSnippets: true,
            hasTables: false,
            allowEmpty: true,
            abort: false,
        })
    })

    it('FROM 表+别名后输入 whe：WHERE 关键字', () => {
        const {ctx, plan, clean, offset} = at('SELECT * FROM orders t1 whe|')
        assert.equal(ctx.fromJoin?.clauseKeywordPrefix, 'whe', 'clauseKeywordPrefix')
        assert.equal(ctx.fromJoin?.tableClauseComplete, true)
        assert.equal(plan.keywordSlot, 'after_table')
        assert.equal(
            shouldAbortCompletion({
                sql: clean,
                offset,
                prefix: 'whe',
                ctx,
                triggerKind: TriggerCharacter,
            }),
            false,
        )
        assert.equal(shouldOfferKeywordAtCursor(clean, 'WHERE', 'whe'), true)
    })

    it('输入 left：JOIN 关键字', () => {
        assertScenario('typing-left', 'SELECT * FROM orders t1 left|', {
            joinKeywordPrefix: 'left',
            afterTable: true,
            hasKeywords: true,
            abort: false,
        })
    })

    it('LEFT JOIN 后：仅表名（不含 FK 一行 JOIN / ij·lf 片段）', () => {
        assertScenario('after-left-join', 'SELECT * FROM orders t1 LEFT JOIN |', {
            slot: 'join',
            stage: 'join.await_table',
            awaitingJoinTable: true,
            tablesFirst: true,
            hasKeywords: false,
            hasFkJoinLines: false,
            hasSnippets: false,
            allowEmpty: true,
            abort: false,
        })
    })

    it('INNER JOIN 后：仅表名', () => {
        assertScenario('after-inner-join', 'SELECT * FROM orders o INNER JOIN |', {
            stage: 'join.await_table',
            awaitingJoinTable: true,
            tablesFirst: true,
            hasKeywords: false,
            hasFkJoinLines: false,
            hasSnippets: false,
        })
    })

    it('JOIN 后输入表前缀', () => {
        assertScenario('join-table-prefix', 'SELECT * FROM orders t1 LEFT JOIN use|', {
            slot: 'join',
            hasTables: true,
            abort: false,
        })
    })

    it('JOIN 表+别名后：应提示 ON 而非再 JOIN', () => {
        assertScenario('after-join-table-alias', 'SELECT * FROM orders t1 LEFT JOIN users u|', {
            slot: 'join',
            awaitingOnClause: true,
            afterTable: false,
            hasKeywords: true,
            hasTables: false,
            allowEmpty: true,
            abort: false,
        })
    })

    it('JOIN 仅表名后：应提示 ON', () => {
        assertScenario('after-join-table-only', 'SELECT * FROM orders t1 LEFT JOIN users|', {
            awaitingOnClause: true,
            hasKeywords: true,
            hasTables: false,
        })
    })

    it('多表 JOIN 行尾 LEFT JOIN 后：仅表名', () => {
        assertScenario('chained-join', 'SELECT * FROM orders o INNER JOIN users u ON 1=1 LEFT JOIN |', {
            awaitingJoinTable: true,
            tablesFirst: true,
            hasKeywords: false,
            hasFkJoinLines: false,
            hasSnippets: false,
        })
    })
})

describe('completion scenarios — ON / WHERE / ORDER', () => {
    it('ON 后：FK/列优先，不展示运算符关键字', () => {
        assertScenario('on-clause', 'SELECT * FROM users u JOIN orders o ON |', {
            slot: 'on',
            hasKeywords: false,
            abort: false,
        })
        const {plan} = at('SELECT * FROM users u JOIN orders o ON |')
        assert.equal(plan.sortProfile, 'column-first')
        assert.equal(plan.keywordPhase, 'none')
        assert.deepEqual(plan.collectors, ['fkOn', 'columns', 'aliasComplete'])
    })

    it('WHERE 刚写完：列优先，不展示 ORDER BY', () => {
        const {plan} = at('SELECT * FROM users WHERE |')
        assert.equal(plan.sortProfile, 'column-first')
        assert.equal(plan.keywordPhase, 'none')
        assert.deepEqual(plan.collectors, ['columns', 'aliasComplete'])
    })

    it('JOIN 右表+别名后：仅 ON 关键字', () => {
        const {plan} = at('SELECT * FROM orders o LEFT JOIN users u|')
        assert.equal(plan.keywordPhase, 'join-on-only')
        assert.equal(plan.collectors.includes('keywords'), true)
        assert.equal(plan.collectors.includes('columns'), false)
    })

    it('WHERE 后：列（不重复 WHERE）', () => {
        assertScenario('where-clause', 'SELECT * FROM users WHERE |', {
            slot: 'where',
            allowEmpty: true,
        })
    })

    it('WHERE 完整后：不重复 WHERE 关键字', () => {
        assert.equal(shouldOfferKeywordAtCursor('SELECT * FROM users WHERE ', 'WHERE', ''), false)
    })

    it('WHERE col = 后：谓词值', () => {
        assertScenario('where-equals', 'SELECT * FROM users WHERE status = |', {
            afterPredicate: true,
            allowEmpty: true,
        })
    })

    it('WHERE AND 后：列名补全（非文档单词）', () => {
        const sql = "SELECT * FROM orders ord WHERE ord.status = 'paid'\n  AND 1=1\n  AND |"
        assertScenario('where-after-and', sql, {
            slot: 'where',
            allowEmpty: true,
            abort: false,
        })
        const {ctx, plan} = at(sql)
        assert.equal(ctx.signals.after_condition_connector, true)
        assert.ok(plan.collectors.includes('columns'))
    })

    it('alias. 列引用', () => {
        assertScenario('column-ref', 'SELECT * FROM users u WHERE u.|', {
            columnRef: true,
            allowEmpty: true,
            abort: false,
        })
    })

    it('函数实参内 alias. 列引用（FROM 在光标后）', () => {
        const {ctx, plan} = at('SELECT SUM(cs.|) FROM cdp_segment cs')
        assert.equal(ctx.slot, 'column_ref')
        assert.equal(ctx.qualifier, 'cs')
        assert.equal(ctx.resolvedTable, 'cdp_segment')
        assert.equal(plan.collectors.includes('columns'), true)
        assert.equal(plan.collectors.includes('snippets'), false)
    })

    it('ORDER BY 列后：ASC/DESC', () => {
        assertScenario('order-by-col', 'SELECT status FROM orders ORDER BY status|', {
            slot: 'order_by',
            afterCompleteCol: true,
            allowEmpty: true,
        })
    })

    it('after-on-complete: WHERE keyword after JOIN ON predicate', () => {
        const {ctx, plan} = at(
            'SELECT * FROM cdp_tag ct LEFT JOIN cdp_segment cs ON ct.id = cs.tag_ids wher|',
        )
        assert.equal(ctx.signals.after_complete_on_predicate, true)
        assert.equal(plan.keywordSlot, 'after_on')
        assert.equal(
            shouldOfferKeywordAtCursor(
                'SELECT * FROM cdp_tag ct LEFT JOIN cdp_segment cs ON ct.id = cs.tag_ids wher',
                'WHERE',
                'wher',
            ),
            true,
        )
    })

    it('WHERE 条件写完后 grou 应提示 GROUP BY 而非列', () => {
        const sql =
            'SELECT * FROM cdp_tag ct LEFT JOIN cdp_segment cs ON ct.id = cs.tag_ids WHERE ct.id = 123 grou|'
        const {ctx, plan} = at(sql)
        assert.equal(ctx.signals.after_complete_where_predicate, true)
        assert.equal(plan.keywordSlot, 'after_where')
        assert.equal(plan.keywordPhase, 'clause-next')
        assert.equal(plan.collectors.includes('keywords'), true)
        assert.equal(plan.collectors.includes('columns'), false)
        assert.equal(
            shouldOfferKeywordAtCursor(
                sql.replace('|', ''),
                'GROUP BY',
                'grou',
            ),
            true,
        )
    })

    it('WHERE 条件写完后空格应提示 GROUP BY / ORDER BY', () => {
        const {ctx, plan} = at(
            'SELECT * FROM users WHERE status = 1 |',
        )
        assert.equal(ctx.signals.after_complete_where_predicate, true)
        assert.equal(plan.keywordSlot, 'after_where')
        assert.deepEqual(plan.collectors, ['keywords', 'snippets'])
    })

    it('WHERE 复合条件写完后应同时提示 AND/OR 与 GROUP BY', () => {
        const line =
            'SELECT * FROM cdp_tag t1 LEFT JOIN cdp_segment cds ON t1.id = cds.tag_ids WHERE 1=1 AND t1.id = 123'
        const {ctx, plan} = at(`${line} |`)
        assert.equal(ctx.signals.after_complete_where_predicate, true)
        assert.equal(plan.keywordSlot, 'after_where')
        assert.equal(plan.collectors.includes('keywords'), true)
        assert.equal(matchesKeywordPrefix('AND', ''), true)
        assert.equal(matchesKeywordPrefix('OR', ''), true)
        assert.equal(matchesKeywordPrefix('GROUP BY', ''), true)
    })

    it('WHERE 字符串条件 + grou 应识别为 GROUP BY 前缀', () => {
        const sql =
            'SELECT * FROM cdp_tag t1 WHERE 1=1 AND t1.id = 123 AND t1.tag_name = \'test\' grou|'
        const {ctx, plan} = at(sql)
        assert.equal(ctx.signals.after_complete_where_predicate, true)
        assert.equal(plan.keywordSlot, 'after_where')
        assert.equal(plan.collectors.includes('columns'), false)
        assert.equal(
            shouldOfferKeywordAtCursor(
                sql.replace('|', ''),
                'GROUP BY',
                'grou',
            ),
            true,
        )
    })

    it('WHERE 完整后分号后仍提示 AND / GROUP BY', () => {
        const sql =
            'SELECT * FROM cdp_tag t1 WHERE 1=1 AND t1.tag_name = \'test\' ;|'
        const {ctx, plan} = at(sql)
        assert.equal(ctx.signals.after_complete_where_predicate, true)
        assert.equal(plan.keywordSlot, 'after_where')
        assert.deepEqual(plan.collectors, ['keywords', 'snippets'])
    })

    it('GROUP BY 后：SELECT 列项，无子句关键字', () => {
        assertScenario('group-by', 'SELECT status, COUNT(*) c FROM orders GROUP BY |', {
            slot: 'group_by',
            hasKeywords: false,
        })
    })

    it('GROUP BY 列写完后：ORDER BY / HAVING / LIMIT', () => {
        const {plan} = at('SELECT status FROM orders GROUP BY status |')
        assert.equal(plan.stage, 'group_by.clause_next')
        assert.equal(plan.keywordSlot, 'after_group_by')
    })
})
