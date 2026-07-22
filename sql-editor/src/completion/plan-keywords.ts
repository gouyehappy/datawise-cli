import type {SqlCompletionContext} from './context'
import type {SqlCompletionPlan} from './grammar/types'
import {filterKeywordsByPhase, sortClauseNextKeywords} from './completion-phase'
import {forbiddenInSelectKeywords} from './keyword-config'
import {filterParserNoiseKeywords} from './parser/parser-keywords'

function normalizeClauseKeyword(keyword: string): string {
    return keyword.trim().replace(/\s+/g, ' ').toUpperCase()
}

function filterKeywordsForDmlStatement(
    ctx: SqlCompletionContext,
    plan: Pick<SqlCompletionPlan, 'keywordSlot' | 'keywordPhase'>,
    keywords: string[],
): string[] {
    if (ctx.statement === 'delete' && plan.keywordSlot === 'after_table') {
        return keywords.filter((kw) => DELETE_AFTER_TABLE_KEYWORDS.has(normalizeClauseKeyword(kw)))
    }
    return keywords
}

const DELETE_AFTER_TABLE_KEYWORDS = new Set(['WHERE'])

function applyForbidden(ctx: SqlCompletionContext, keywords: string[]): string[] {
    if (ctx.statement !== 'select') return keywords
    const forbidden = forbiddenInSelectKeywords()
    return keywords.filter((kw) => !forbidden.has(kw))
}

/** 补全关键字：来自 plan.configuredKeywords（keywords-config），经 keywordPhase 过滤 */
export function resolveCompletionKeywords(
    ctx: SqlCompletionContext,
    plan: Pick<SqlCompletionPlan, 'keywordPhase' | 'keywordSlot'> & {
        parserKeywords?: string[]
    },
): string[] {
    if (plan.keywordPhase === 'function-open' || plan.keywordSlot === 'select_aggregate') {
        return ['(']
    }

    let keywords = plan.parserKeywords?.length ? [...plan.parserKeywords] : []
    keywords = filterParserNoiseKeywords(keywords)
    keywords = applyForbidden(ctx, keywords)
    if (!keywords.length) return []

    keywords = filterKeywordsByPhase(keywords, plan.keywordPhase)
    keywords = filterKeywordsForDmlStatement(ctx, plan, keywords)
    if (plan.keywordPhase === 'clause-next' || plan.keywordPhase === 'clause-prefix') {
        keywords = sortClauseNextKeywords(keywords)
    }
    return keywords
}
