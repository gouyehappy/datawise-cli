import {isSqlEditorAiCompletionEnabled} from '@sql-editor/ai/settings'
import {matchesAiAssistPrefix} from '@sql-editor/ai/completion-scenarios'
import {getActiveSqlEditorRuntime} from '@sql-editor/runtime/sql-editor-runtime'
import type {SqlCompletionContext} from '../context'
import {hasSignal} from '../context'
import type {SqlCompletionPlan} from '../grammar/types'
import type {CompletionCollector} from '../completion-collectors'
import type {SqlCompletionSlot} from '@sql-editor/types'

/** 列名匹配策略（模板字段，集中门控） */
export type ColumnMatchMode =
    | 'off'
    | 'allow-empty'
    | 'prefix-only'
    | 'prefix-or-chain'

const COLUMN_COLLECTORS = new Set<CompletionCollector>([
    'columns',
    'aliasDotStar',
    'aliasComplete',
    'starExpansion',
    'fkOn',
])

const NO_COLUMN_STAGES = new Set<string>([
    'predicate.after_on_complete',
    'predicate.after_where_complete',
    'predicate.after_column',
    'predicate.pick_value',
    'group_by.clause_next',
    'join.on_keyword',
    'table.clause_next',
    'select_list.after_aggregate',
    'order_by.after_column',
])

function defaultColumnMatch(stage: string | undefined): ColumnMatchMode {
    if (!stage) return 'prefix-only'
    if (stage === 'predicate.pick_column' || stage === 'predicate.pick_fk_on_column') return 'allow-empty'
    if (
        stage === 'group_by.pick_column' ||
        stage === 'group_by.after_comma' ||
        stage === 'order_by.pick_column' ||
        stage === 'order_by.after_comma'
    ) {
        return 'allow-empty'
    }
    if (stage === 'select_list.after_comma') return 'prefix-or-chain'
    if (stage === 'select_list.default') return 'allow-empty'
    return 'prefix-only'
}

export function resolveColumnMatchMode(plan: SqlCompletionPlan): ColumnMatchMode {
    if (plan.columnMatch) return plan.columnMatch
    return defaultColumnMatch(plan.stage)
}

function shouldRunKeywordCollector(
    plan: SqlCompletionPlan,
    ctx: SqlCompletionContext,
    prefix: string,
): boolean {
    if (plan.keywordPhase === 'none') return false
    if (plan.keywordPhase === 'clause-prefix' && !prefix) return false
    if (ctx.slot === 'column_ref' && !hasSignal(ctx, 'after_complete_column_ref')) return false
    if (hasSignal(ctx, 'after_condition_connector') && !prefix) return false
    if (hasSignal(ctx, 'after_predicate_operator')) return false
    return true
}

function planAllowsSnippets(
    plan: Pick<SqlCompletionPlan, 'keywordPhase' | 'keywordSlot'>,
    slot: SqlCompletionSlot,
): boolean {
    if (plan.keywordPhase === 'none') {
        return slot === 'statement_start' || slot === 'from' || slot === 'join'
    }
    if (plan.keywordPhase === 'clause-next') return true
    return plan.keywordPhase === 'all'
}

function shouldRunSnippetCollector(
    plan: SqlCompletionPlan,
    ctx: SqlCompletionContext,
    prefix: string,
): boolean {
    if (hasSignal(ctx, 'after_condition_connector') && !prefix) return false
    if (ctx.fromJoin?.clauseKeywordPrefix && !ctx.fromJoin.joinKeywordPrefix) return false
    return planAllowsSnippets(plan, ctx.slot)
}

/** 是否应运行某收集器（grammar 阶段 + 前缀策略，单一门控） */
export function shouldRunCollector(
    collector: CompletionCollector,
    plan: SqlCompletionPlan,
    ctx: SqlCompletionContext,
    prefix: string,
): boolean {
    if (collector === 'keywords') {
        return shouldRunKeywordCollector(plan, ctx, prefix)
    }
    if (collector === 'snippets') {
        return shouldRunSnippetCollector(plan, ctx, prefix)
    }
    if (collector === 'predicateValues') {
        return hasSignal(ctx, 'after_predicate_operator')
    }
    if (collector === 'aiAssist') {
        const ai = getActiveSqlEditorRuntime().getEffectiveSettings().ai
        if (!isSqlEditorAiCompletionEnabled(ai)) return false
        return matchesAiAssistPrefix(prefix)
    }

    if (!COLUMN_COLLECTORS.has(collector)) return true
    if (plan.stage && NO_COLUMN_STAGES.has(plan.stage)) return false

    const mode = resolveColumnMatchMode(plan)
    if (mode === 'off') return false

    if (mode === 'allow-empty') return true

    if (mode === 'prefix-or-chain') {
        if (prefix.length > 0) return true
        return hasSignal(ctx, 'after_comma')
    }

    return prefix.length > 0
}
