import {
    buildInnerJoinLine,
    buildInnerJoinLineInsert,
    buildLeftJoinLine,
    buildLeftJoinLineInsert,
    fkJoinLineCandidates,
    matchesFkJoinLinePrefix,
} from '@sql-editor/utils/fk-join-lines'
import {adjustKeywordInsertNewlines} from '@sql-editor/utils/format-as-you-type'
import {tablesReferencedInQuery} from '../context'
import type {SqlCompletionContext} from '../context'
import type {SqlCompletionPlan} from '../grammar/types'
import {shouldSuggestTables} from '../suggestion-policy'
import {
    categoryCompletionLabel,
    completionItemKind,
    tableCompletionLabel,
} from '../completion-labels'
import {buildFilterText} from '../filter-text'
import {completionSort} from './sort-state'
import type {SuggestEditorSlice, SuggestItem, SuggestPush, SuggestTextRange} from '../suggest-types'
import {LARGE_SCHEMA_TABLE_THRESHOLD, MAX_TABLE_SUGGESTIONS} from '../limits'
import {getSchemaContext, localeT, typeT, uniqueTables} from './collector-locale'
import {collectCatalogSchemaSuggestions} from './catalog-schema-collectors'
import {isCatalogSchemaTableStage} from '@sql-editor/utils/from-qualified-input'
import {preferredAlias, tableCompletionInsertText} from '@sql-editor/utils/alias'
import {catalogForTable, fkJoinConditions, relatedTablesForJoin} from '@sql-editor/utils/schema-columns'

const TRIGGER_SUGGEST_COMMAND = {id: 'editor.action.triggerSuggest', title: 'Trigger Suggest'} as const

export function collectFkJoinLineSuggestions(
    ctx: SqlCompletionContext,
    push: SuggestPush,
    editor: SuggestEditorSlice,
    range: SuggestTextRange,
    prefix: string,
) {
    if (ctx.fromJoin?.joinKeywordPrefix) return

    const afterFromTable =
        ctx.slot === 'from' && ctx.signals.from_table_clause_complete
    if (ctx.slot !== 'join' && !afterFromTable) return

    const inQuery = tablesReferencedInQuery(ctx)
    if (!inQuery.length) return

    const candidates = fkJoinLineCandidates(
        getSchemaContext(),
        inQuery,
        ctx.aliases,
        editor.fullSql,
        editor.lineAtRange,
        editor.cursorOffset,
    )

    let index = 0
    for (const candidate of candidates) {
        const showInner = matchesFkJoinLinePrefix(candidate, prefix, 'inner')
        const showLeft = matchesFkJoinLinePrefix(candidate, prefix, 'left')
        if (!showInner && !showLeft) continue

        if (showInner) {
            const innerLine = buildInnerJoinLine(candidate)
            const insertText = adjustKeywordInsertNewlines(
                buildInnerJoinLineInsert(candidate),
                editor.lineBeforeCursor,
            )
            push({
                label: categoryCompletionLabel(
                    localeT('completion.alias_arrow', {table: candidate.targetTable}),
                    typeT('fk'),
                ),
                kind: completionItemKind('fk'),
                insertText,
                detail: localeT('completion.inner_join_fk', {condition: candidate.condition}),
                filterText: buildFilterText(candidate.targetTable, [
                    innerLine,
                    candidate.sourceTable,
                    'join',
                    'fk',
                    'inner',
                    'ij',
                ]),
                range,
                sortText: completionSort('fkjoin', index),
                preselect: index === 0,
                command: TRIGGER_SUGGEST_COMMAND,
            })
        }

        if (showLeft) {
            const leftLine = buildLeftJoinLine(candidate)
            const insertText = adjustKeywordInsertNewlines(
                buildLeftJoinLineInsert(candidate),
                editor.lineBeforeCursor,
            )
            push({
                label: categoryCompletionLabel(
                    localeT('completion.fk_join_target_left', {table: candidate.targetTable}),
                    typeT('fk'),
                ),
                kind: completionItemKind('fk'),
                insertText,
                detail: localeT('completion.left_join_fk', {condition: candidate.condition}),
                filterText: buildFilterText(candidate.targetTable, [
                    leftLine,
                    candidate.sourceTable,
                    'join',
                    'fk',
                    'left',
                    'lj',
                    'lf',
                ]),
                range,
                sortText: completionSort('fkjoin', index + 500),
                command: TRIGGER_SUGGEST_COMMAND,
            })
        }

        index++
    }
}

export function collectTableSuggestions(
    ctx: SqlCompletionContext,
    push: SuggestPush,
    editor: SuggestEditorSlice,
    range: SuggestTextRange,
    prefix: string,
    plan: SqlCompletionPlan,
) {
    if (!shouldSuggestTables(ctx)) return
    const schema = getSchemaContext()
    collectCatalogSchemaSuggestions(ctx, push, range, prefix, schema)

    const qualifiedInput = ctx.fromJoin?.tablePrefix || prefix
    if (!isCatalogSchemaTableStage(schema, qualifiedInput)) {
        return
    }

    const line = editor.lineAtRange
    const sql = editor.fullSql
    const cursorOffset = editor.cursorOffset
    const inQuery = tablesReferencedInQuery(ctx)
    const related = new Set(relatedTablesForJoin(getSchemaContext(), inQuery).map((t) => t.toLowerCase()))

    const allTables = uniqueTables(getSchemaContext().tables)
    const prefixLower = prefix.toLowerCase()
    const byRelatedThenName = (a: string, b: string) => {
        const aRel = related.has(a.toLowerCase()) ? 0 : 1
        const bRel = related.has(b.toLowerCase()) ? 0 : 1
        if (aRel !== bRel) return aRel - bRel
        return a.localeCompare(b)
    }

    let tables: string[]
    if (allTables.length > LARGE_SCHEMA_TABLE_THRESHOLD) {
        const relatedTables = allTables
            .filter((t) => related.has(t.toLowerCase()))
            .sort(byRelatedThenName)
        const prefixMatches = prefix
            ? allTables
                .filter(
                    (t) =>
                        !related.has(t.toLowerCase()) && t.toLowerCase().startsWith(prefixLower),
                )
                .sort((a, b) => a.localeCompare(b))
            : []
        tables = [...relatedTables, ...prefixMatches]
    } else {
        tables = [...allTables].sort(byRelatedThenName)
    }

    let index = 0
    let first = true
    const nameOnly = plan.tableInsertMode === 'name-only'
    for (const table of tables) {
        if (index >= MAX_TABLE_SUGGESTIONS) break
        if (prefix && !table.toLowerCase().startsWith(prefixLower)) continue
        const {insertText, detail} = tableCompletionInsertText(
            table,
            line,
            range.endColumn,
            ctx.aliases,
            sql,
            cursorOffset,
            nameOnly ? {insertMode: 'name-only'} : undefined,
        )
        // FROM/JOIN：别名后留空格并链式再弹（JOIN/WHERE/ON）
        const chainedText =
            nameOnly || insertText.endsWith(' ') ? insertText : `${insertText} `
        const catalog = catalogForTable(getSchemaContext(), table)
        const rightDetail = [
            detail || null,
            related.has(table.toLowerCase()) ? localeT('completion.foreign_key') : null,
        ].filter(Boolean).join(' | ')
        push({
            label: tableCompletionLabel(
                table,
                typeT('table'),
                undefined,
                catalog,
                rightDetail,
            ),
            kind: completionItemKind('table'),
            insertText: chainedText,
            detail: rightDetail,
            filterText: buildFilterText(table, [insertText, catalog ?? '']),
            range,
            sortText: completionSort('table', related.has(table.toLowerCase()) ? index : index + 500),
            preselect: first && ctx.slot !== 'join',
            command: nameOnly ? undefined : TRIGGER_SUGGEST_COMMAND,
        })
        first = false
        index++
    }
}

export function collectFkOnSuggestions(
    ctx: SqlCompletionContext,
    push: (item: SuggestItem) => void,
    range: SuggestTextRange,
    prefix: string,
) {
    if (ctx.slot !== 'on') return
    const tables = tablesReferencedInQuery(ctx)
    if (tables.length < 2) return

    let index = 0
    for (let i = 0; i < tables.length; i++) {
        for (let j = i + 1; j < tables.length; j++) {
            const tableA = tables[i]
            const tableB = tables[j]
            const aliasA = preferredAlias(tableA, ctx.aliases)
            const aliasB = preferredAlias(tableB, ctx.aliases)
            for (const condition of fkJoinConditions(getSchemaContext(), tableA, aliasA, tableB, aliasB)) {
                if (prefix && !condition.toLowerCase().includes(prefix.toLowerCase())) continue
                push({
                    label: categoryCompletionLabel(condition, typeT('fk')),
                    kind: completionItemKind('fk'),
                    insertText: condition,
                    detail: localeT('completion.foreign_key'),
                    filterText: buildFilterText(condition, [tableA, tableB]),
                    range,
                    sortText: completionSort('fkjoin', index++),
                    preselect: index === 1,
                })
            }
        }
    }
}
