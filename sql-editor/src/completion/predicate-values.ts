import type {SqlCompletionContext} from './context'
import {classifyColumnType} from './column-type'
import {hintCompletionPresentation, completionItemKind} from './completion-labels'
import {sortTextForProfile} from './completion-phase'
import {matchesCompletionPrefix, buildFilterText} from './filter-text'
import {resolvePredicateLeftColumn} from './predicate-column'
import {
    buildPredicateValueItems,
    detectValueTail,
    predicateColumnEnumValues,
} from './predicate-value-templates'
import type {SuggestPush, SuggestTextRange} from './suggest-types'
import {SUGGEST_INSERT_AS_SNIPPET} from './suggest-types'
import {sqlEditorT} from '@sql-editor/i18n'
import {getActiveSqlEditorRuntime} from '@sql-editor/runtime/sql-editor-runtime'
import type {SqlEditorSchema} from '@sql-editor/types'

function localeT(key: string) {
    return sqlEditorT(getActiveSqlEditorRuntime().getLocale(), key)
}

/** = / LIKE / IN / IS 后：值与子查询，不展示 AND/OR 等谓词关键字 */
export function collectPredicateValueSuggestions(
    ctx: SqlCompletionContext,
    push: SuggestPush,
    range: SuggestTextRange,
    prefix: string,
    schema: SqlEditorSchema,
    knownTables: string[],
) {
    const tail = detectValueTail(ctx.segment)
    if (!tail) return

    const left = resolvePredicateLeftColumn(ctx.segment, ctx.aliases, knownTables, schema)
    const columnKind = classifyColumnType(left?.meta.type)
    const enums = predicateColumnEnumValues(left?.meta)
    const items = buildPredicateValueItems(
        tail,
        columnKind,
        enums,
        left?.meta,
        localeT('completion.value.between_label'),
    )
    if (!items.length) return

    const typeHint = left?.meta.type ? ` · ${left.meta.type}` : ''

    let index = 0
    let first = true
    for (const item of items) {
        if (prefix && !matchesCompletionPrefix(item.label, prefix) && !matchesCompletionPrefix(item.insertText, prefix)) {
            continue
        }
        const kindKey = item.kind ?? 'value'
        const typeBadge = localeT(`completion.type.${kindKey}`)
        const hint = localeT(item.detailKey) + typeHint
        const presentation = hintCompletionPresentation(item.label, hint, typeBadge)
        const preselect =
            first &&
            (kindKey === 'value'
                ? true
                : columnKind === 'numeric' || columnKind === 'boolean'
                    ? kindKey === 'value_number'
                    : columnKind === 'string' || columnKind === 'temporal'
                        ? kindKey === 'value_string'
                        : kindKey === 'value_number')
        push({
            label: presentation.label,
            kind: completionItemKind(kindKey),
            insertText: item.insertText,
            insertTextRules: item.snippet ? SUGGEST_INSERT_AS_SNIPPET : undefined,
            detail: presentation.detail,
            documentation: presentation.documentation,
            filterText: buildFilterText(item.label, [hint, typeBadge, left?.column ?? '']),
            range,
            sortText: sortTextForProfile('column-first', 'keyword', index),
            preselect,
        })
        first = false
        index++
    }
}

export {buildPredicateValueItems} from './predicate-value-templates'
