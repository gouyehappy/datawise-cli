import type {CompletionStage, StagePlanTemplate, SqlCompletionPlan, KeywordSlotOverride} from './types'
import type {SqlCompletionSlot} from '@sql-editor/types'

/** 各阶段默认补全策略（单一事实来源） */
export const STAGE_PLAN_TEMPLATES: Record<CompletionStage, StagePlanTemplate> = {
    'table.pick': {
        collectors: ['fkJoinLines', 'tables', 'snippets'],
        sortProfile: 'table-first',
        keywordPhase: 'none',
        suppressTables: false,
    },
    'table.clause_next': {
        collectors: ['fkJoinLines', 'keywords', 'snippets'],
        sortProfile: 'keyword-first',
        keywordPhase: 'clause-next',
        keywordSlot: 'after_table',
        suppressTables: true,
    },
    /** JOIN 关键字已完整（LEFT JOIN 等）→ 仅右表名 */
    'join.await_table': {
        collectors: ['tables'],
        sortProfile: 'table-first',
        keywordPhase: 'none',
        suppressTables: false,
    },
    'join.on_keyword': {
        collectors: ['keywords'],
        sortProfile: 'keyword-first',
        keywordPhase: 'join-on-only',
        keywordSlot: 'after_join_table',
        suppressTables: true,
    },

    'predicate.pick_fk_on_column': {
        collectors: ['fkOn', 'columns', 'aliasComplete'],
        sortProfile: 'column-first',
        keywordPhase: 'none',
    },
    'predicate.pick_column': {
        collectors: ['columns', 'aliasComplete'],
        sortProfile: 'column-first',
        keywordPhase: 'none',
    },
    'predicate.after_column': {
        collectors: ['keywords', 'snippets'],
        sortProfile: 'keyword-first',
        keywordPhase: 'operators',
    },
    'predicate.pick_value': {
        collectors: ['predicateValues'],
        sortProfile: 'column-first',
        keywordPhase: 'none',
    },
    'predicate.after_connector': {
        collectors: ['columns', 'aliasComplete'],
        sortProfile: 'column-first',
        keywordPhase: 'none',
    },
    'predicate.after_on_complete': {
        collectors: ['keywords', 'snippets'],
        sortProfile: 'keyword-first',
        keywordPhase: 'clause-next',
        keywordSlot: 'after_on',
    },
    'predicate.after_where_complete': {
        collectors: ['keywords', 'snippets'],
        sortProfile: 'keyword-first',
        keywordPhase: 'clause-next',
        keywordSlot: 'after_where',
    },

    'select_list.default': {
        collectors: [
            'starExpansion',
            'columns',
            'aliasDotStar',
            'aliasComplete',
            'keywords',
            'snippets',
        ],
        sortProfile: 'column-first',
        keywordPhase: 'clause-prefix',
    },
    'select_list.after_comma': {
        collectors: [
            'starExpansion',
            'columns',
            'aliasDotStar',
            'keywords',
            'snippets',
            'aliasComplete',
        ],
        sortProfile: 'column-first',
        keywordPhase: 'clause-prefix',
        columnMatch: 'prefix-or-chain',
    },
    'select_list.after_aggregate': {
        collectors: ['keywords'],
        sortProfile: 'keyword-first',
        keywordPhase: 'function-open',
        keywordSlot: 'select_aggregate',
        columnMatch: 'off',
    },
    'column_ref.default': {
        collectors: ['columns', 'aliasComplete'],
        sortProfile: 'column-first',
        keywordPhase: 'none',
        /** alias. 后空前缀 — 立即列出该表全部列 */
        columnMatch: 'allow-empty',
    },
    'group_by.pick_column': {
        collectors: ['columns'],
        sortProfile: 'column-first',
        keywordPhase: 'none',
    },
    'group_by.after_comma': {
        collectors: ['columns'],
        sortProfile: 'column-first',
        keywordPhase: 'none',
    },
    'group_by.clause_next': {
        collectors: ['keywords', 'snippets'],
        sortProfile: 'keyword-first',
        keywordPhase: 'clause-next',
        keywordSlot: 'after_group_by',
    },
    'order_by.pick_column': {
        collectors: ['columns'],
        sortProfile: 'column-first',
        keywordPhase: 'none',
    },
    'order_by.after_comma': {
        collectors: ['columns'],
        sortProfile: 'column-first',
        keywordPhase: 'none',
    },
    'order_by.after_column': {
        collectors: ['keywords', 'snippets'],
        sortProfile: 'keyword-first',
        keywordPhase: 'sort-direction',
    },

    'insert.values': {
        collectors: ['keywords', 'snippets', 'columns', 'aliasComplete'],
        sortProfile: 'keyword-first',
        keywordPhase: 'all',
    },
    'insert.columns': {
        collectors: ['fkJoinLines', 'tables', 'snippets'],
        sortProfile: 'table-first',
        keywordPhase: 'none',
        suppressTables: false,
    },
    'update.set': {
        collectors: ['columns', 'aliasComplete', 'keywords', 'snippets'],
        sortProfile: 'column-first',
        keywordPhase: 'all',
    },
    'delete.from': {
        collectors: ['fkJoinLines', 'tables', 'snippets'],
        sortProfile: 'table-first',
        keywordPhase: 'none',
        suppressTables: false,
    },

    'statement.start': {
        collectors: ['keywords', 'snippets'],
        sortProfile: 'keyword-first',
        keywordPhase: 'all',
        keywordSlot: 'statement_start',
    },
    'clause.keyword_first': {
        collectors: [
            'keywords',
            'snippets',
            'starExpansion',
            'columns',
            'aliasDotStar',
            'aliasComplete',
        ],
        sortProfile: 'keyword-first',
        keywordPhase: 'all',
    },
    'clause.column_first': {
        collectors: ['columns', 'aliasComplete', 'keywords', 'snippets'],
        sortProfile: 'column-first',
        keywordPhase: 'all',
    },
    'ddl.keywords': {
        collectors: ['keywords', 'snippets'],
        sortProfile: 'keyword-first',
        keywordPhase: 'all',
    },
    'ddl.pick_table': {
        collectors: ['tables'],
        sortProfile: 'table-first',
        keywordPhase: 'none',
        tableInsertMode: 'name-only',
    },
    'ddl.create_rest': {
        collectors: [],
        sortProfile: 'keyword-first',
        keywordPhase: 'none',
        suppressTables: true,
    },
    'ddl.column_type': {
        collectors: ['ddlTypes'],
        sortProfile: 'keyword-first',
        keywordPhase: 'none',
        suppressTables: true,
    },
}

function resolveKeywordSlot(
    template: StagePlanTemplate,
    eff: SqlCompletionSlot,
): KeywordSlotOverride {
    return template.keywordSlot ?? eff
}

export function buildPlanFromStage(
    stage: CompletionStage,
    eff: SqlCompletionSlot,
): SqlCompletionPlan {
    const template = STAGE_PLAN_TEMPLATES[stage]
    const keywordSlot = resolveKeywordSlot(template, eff)
    const sortProfile = template.sortProfile
    return {
        stage,
        collectors: [...template.collectors],
        sortProfile,
        keywordPhase: template.keywordPhase,
        keywordSlot,
        suppressTables: template.suppressTables ?? false,
        columnMatch: template.columnMatch,
        tableInsertMode: template.tableInsertMode,
    }
}
