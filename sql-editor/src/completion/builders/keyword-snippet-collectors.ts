import type {SqlCompletionContext} from '../context'
import {effectiveCompletionSlot} from '../context'
import type {SqlCompletionPlan} from '../grammar/types'
import {resolveCompletionKeywords} from '../plan-keywords'
import {listSqlDialectFunctionSignatures} from '../function-signatures'
import {
    buildFunctionInsertSnippet,
    formatFunctionDisplaySignature,
    functionFilterText,
} from '../function-presentation'
import {snippetsForContext} from '../suggestion-policy'
import {presentSnippetFromConfig} from '../snippet-presentation'
import {categoryCompletionLabel, completionItemKind, functionCompletionLabel} from '../completion-labels'
import {buildFilterText, keywordFilterText, matchesCompletionPrefix, matchesKeywordPrefix} from '../filter-text'
import {shouldOfferKeywordAtCursor} from '../completed-keyword'
import {SQL_DDL_COLUMN_TYPES} from '../ddl-column-types'
import {completionSort} from './sort-state'
import type {SuggestEditorSlice, SuggestItem, SuggestPush, SuggestTextRange} from '../suggest-types'
import {SUGGEST_INSERT_AS_SNIPPET} from '../suggest-types'
import {localeT, typeT} from './collector-locale'
import type {SqlCompletionSlot} from '@sql-editor/types'
import {getActiveSqlEditorRuntime} from '@sql-editor/runtime/sql-editor-runtime'
import {resolveSqlDialectFile} from '@sql-editor/completion/dialect-aliases'

const CHAIN_CONNECTOR_KEYWORDS = new Set([
    'AND',
    'OR',
    'ORDER BY',
    'GROUP BY',
    'HAVING',
    'LIMIT',
    'OFFSET',
])

/** 列/表达式槽位：注入方言函数补全（与 keywordPhase 解耦） */
const FUNCTION_SUGGESTION_SLOTS = new Set([
    'select_list',
    'column_ref',
    'where',
    'having',
    'on',
    'set',
    'group_by',
    'order_by',
])

export function collectKeywordSuggestions(
    ctx: SqlCompletionContext,
    push: SuggestPush,
    editor: SuggestEditorSlice,
    range: SuggestTextRange,
    prefix: string,
    plan: SqlCompletionPlan,
) {
    const kwType = typeT('keyword')
    const fnType = typeT('function')
    const afterClause =
        plan.keywordSlot === 'after_table' ||
        plan.keywordSlot === 'after_on' ||
        plan.keywordSlot === 'after_where' ||
        plan.keywordSlot === 'after_group_by'
    let index = 0
    let preselected = false
    const predicateClauseExit =
        ctx.signals.after_complete_where_predicate || ctx.signals.after_complete_on_predicate || ctx.signals.after_complete_group_by_list
    const fromParser = (plan.parserKeywords?.length ?? 0) > 0
    const lineBefore = editor.lineBeforeCursor

    const slot = effectiveCompletionSlot(ctx)

    // 先提供「函数」提示：按方言配置，主要用于 SELECT / predicate 中的输入前缀补全
    if (
        !afterClause &&
        FUNCTION_SUGGESTION_SLOTS.has(slot) &&
        /[A-Za-z_]/.test(prefix)
    ) {
        let fnIndex = 0
        let fnPreselected = false
        for (const fn of listSqlDialectFunctionSignatures()) {
            if (!matchesCompletionPrefix(fn.name, prefix)) continue
            const displaySignature = formatFunctionDisplaySignature(fn.signature) ?? '()'
            push({
                label: functionCompletionLabel(fn.name, fnType, displaySignature, fn.returns),
                kind: completionItemKind('function'),
                insertText: buildFunctionInsertSnippet(fn),
                insertTextRules: SUGGEST_INSERT_AS_SNIPPET,
                filterText: functionFilterText(fn.name),
                range,
                sortText: completionSort('function', fnIndex++),
                preselect: !fnPreselected,
            })
            fnPreselected = true
        }
    }

    for (const keyword of resolveCompletionKeywords(ctx, plan)) {
        const prefixOk = matchesKeywordPrefix(keyword, prefix)
        if (predicateClauseExit) {
            if (!prefixOk) continue
        } else if (fromParser && prefix && !prefixOk) {
            continue
        }
        if (!shouldOfferKeywordAtCursor(lineBefore, keyword, prefix)) continue
        if (
            ctx.signals.after_condition_connector &&
            CHAIN_CONNECTOR_KEYWORDS.has(keyword.toUpperCase())
        ) {
            continue
        }
        const preferWhere =
            plan.keywordSlot === 'after_table' &&
            !preselected &&
            (!prefix || prefix.toLowerCase().startsWith('wh'))
        const preselect =
            !preselected &&
            ((preferWhere && keyword.toUpperCase() === 'WHERE') ||
                (!preferWhere && plan.sortProfile === 'keyword-first' && index === 0))
        if (preselect) preselected = true
        push({
            label: categoryCompletionLabel(keyword, kwType),
            kind: completionItemKind('keyword'),
            insertText: afterClause ? `${keyword} ` : keyword,
            detail: localeT('completion.keyword'),
            filterText: keywordFilterText(keyword),
            range,
            sortText: completionSort('keyword', index),
            preselect,
        })
        index++
    }
}

export function collectDdlTypeSuggestions(
    push: SuggestPush,
    range: SuggestTextRange,
    prefix: string,
) {
    const typeLabel = typeT('keyword')
    let index = 0
    for (const ddlType of SQL_DDL_COLUMN_TYPES) {
        if (prefix && !ddlType.toLowerCase().startsWith(prefix.toLowerCase())) continue
        push({
            label: categoryCompletionLabel(ddlType, typeLabel),
            kind: completionItemKind('keyword'),
            insertText: ddlType,
            detail: typeLabel,
            filterText: buildFilterText(ddlType, [ddlType]),
            range,
            sortText: completionSort('keyword', index++),
        })
    }
}

export function collectSnippetSuggestions(
    ctx: SqlCompletionContext,
    push: (item: SuggestItem) => void,
    range: SuggestTextRange,
    prefix: string,
    snippetSlot: SqlCompletionSlot,
    _plan: SqlCompletionPlan,
) {
    let index = 0
    const locale = getActiveSqlEditorRuntime().getLocale()
    const dialectFile = resolveSqlDialectFile(getActiveSqlEditorRuntime().getDialect())
    const snippetType = typeT('snippet')
    for (const snippet of snippetsForContext(ctx.statement, snippetSlot, prefix, ctx.segment)) {
        const presentation = presentSnippetFromConfig(
            snippet,
            locale,
            snippetType,
            dialectFile === 'sqlserver' ? 'sqlserver' : undefined,
        )
        push({
            label: presentation.completionLabel,
            kind: completionItemKind('snippet'),
            insertText: snippet.insertText,
            insertTextRules: SUGGEST_INSERT_AS_SNIPPET,
            detail: presentation.completionDetail,
            documentation: presentation.documentation,
            filterText: buildFilterText(snippet.label, [
                presentation.summary,
                presentation.sqlPreview,
                snippetType,
            ]),
            range,
            sortText: completionSort('snippet', index++),
            command: {id: 'editor.action.triggerSuggest', title: 'Trigger Suggest'},
        })
    }
}
