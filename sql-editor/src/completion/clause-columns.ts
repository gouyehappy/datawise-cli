import type {SqlCompletionContext} from './context'
import {hintCompletionPresentation, completionItemKind, type CompletionDisplayCategory} from './completion-labels'
import {groupBySelectItems, orderBySelectItems} from './select-list'
import {matchesCompletionPrefix, columnFilterText} from './filter-text'
import {isColumnAlreadySelected, selectedColumnRefs} from '@sql-editor/utils/selected-columns'
import {sqlEditorT} from '@sql-editor/i18n'
import {getActiveSqlEditorRuntime} from '@sql-editor/runtime/sql-editor-runtime'
import type {SuggestPush, SuggestTextRange} from './suggest-types'
import {SUGGEST_INSERT_AS_SNIPPET} from './suggest-types'

function localeT(key: string, params?: Record<string, string | number>) {
    return sqlEditorT(getActiveSqlEditorRuntime().getLocale(), key, params)
}

function sortText(index: number, boost = 0): string {
    return String(100 + boost + index).padStart(4, '0')
}

function pushSelectListItem(
    push: SuggestPush,
    range: SuggestTextRange,
    prefix: string,
    label: string,
    insertText: string,
    hint: string,
    badge: string,
    category: CompletionDisplayCategory,
    sort: string,
    preselect: boolean,
    chainComma: boolean,
) {
    if (
        prefix &&
        !matchesCompletionPrefix(label, prefix) &&
        !matchesCompletionPrefix(insertText, prefix)
    ) {
        return
    }

    const presentation = hintCompletionPresentation(label, hint, badge)
    push({
        label: presentation.label,
        kind: completionItemKind(category),
        insertText,
        detail: presentation.detail,
        documentation: presentation.documentation,
        filterText: columnFilterText(label),
        range,
        sortText: sort,
        preselect,
        command: chainComma ? {id: 'editor.action.triggerSuggest', title: 'Trigger Suggest'} : undefined,
    })
}

/** GROUP BY：仅 SELECT 非聚合列 / 表达式 */
export function collectGroupByColumnSuggestions(
    ctx: SqlCompletionContext,
    push: SuggestPush,
    range: SuggestTextRange,
    prefix: string,
) {
    const items = groupBySelectItems(ctx.segment)
    if (!items.length) return

    const badge = localeT('completion.type.group_by')
    const alreadySelected = selectedColumnRefs(ctx.segment, 'group_by')
    const chainComma = ctx.signals.after_comma && !prefix
    let index = 0
    let first = chainComma

    for (const item of items) {
        const label = item.alias ?? item.expression
        const insertText = item.expression
        if (isColumnAlreadySelected(label, insertText, alreadySelected)) continue

        const hint = item.alias
            ? localeT('completion.group_by.alias', {expr: item.expression})
            : localeT('completion.group_by.expression')

        pushSelectListItem(
            push,
            range,
            prefix,
            label,
            chainComma ? `${insertText},\n  ` : insertText,
            hint,
            badge,
            'group_by',
            sortText(index++),
            first,
            chainComma,
        )
        first = false
    }
}

/** ORDER BY：优先别名，其次表达式，并提供序号 1..n */
export function collectOrderByColumnSuggestions(
    ctx: SqlCompletionContext,
    push: SuggestPush,
    range: SuggestTextRange,
    prefix: string,
) {
    const items = orderBySelectItems(ctx.segment)
    if (!items.length) return

    const badge = localeT('completion.type.order_by')
    const alreadySelected = selectedColumnRefs(ctx.segment, 'order_by')
    const chainComma = ctx.signals.after_comma && !prefix
    const pushed = new Set<string>()
    let index = 0
    let first = chainComma

    for (const item of items) {
        if (item.alias) {
            const key = `alias:${item.alias.toLowerCase()}`
            if (pushed.has(key)) continue
            pushed.add(key)
            if (isColumnAlreadySelected(item.alias, item.alias, alreadySelected)) continue

            pushSelectListItem(
                push,
                range,
                prefix,
                item.alias,
                chainComma ? `${item.alias},\n  ` : item.alias,
                localeT('completion.order_by.alias', {ordinal: item.ordinal, expr: item.expression}),
                badge,
                'order_by',
                sortText(index++, -20),
                first,
                chainComma,
            )
            first = false
        }
    }

    for (const item of items) {
        const key = `expr:${item.expression.toLowerCase()}`
        if (pushed.has(key)) continue
        if (item.alias && item.alias.toLowerCase() === item.expression.toLowerCase()) continue
        pushed.add(key)
        if (isColumnAlreadySelected(item.expression, item.expression, alreadySelected)) continue

        const label = item.alias ?? item.expression
        pushSelectListItem(
            push,
            range,
            prefix,
            label,
            chainComma ? `${item.expression},\n  ` : item.expression,
            localeT('completion.order_by.expression', {ordinal: item.ordinal}),
            badge,
            'order_by',
            sortText(index++),
            first,
            chainComma,
        )
        first = false
    }

    for (const item of items) {
        const ordinal = String(item.ordinal)
        const key = `ord:${ordinal}`
        if (pushed.has(key)) continue
        pushed.add(key)
        if (isColumnAlreadySelected(ordinal, ordinal, alreadySelected)) continue

        const label = item.alias ?? item.expression
        pushSelectListItem(
            push,
            range,
            prefix,
            ordinal,
            chainComma ? `${ordinal},\n  ` : ordinal,
            localeT('completion.order_by.ordinal', {ordinal: item.ordinal, label}),
            localeT('completion.type.ordinal'),
            'ordinal',
            sortText(index++, 30),
            first,
            chainComma,
        )
        first = false
    }
}
