import type {SqlColumnMeta} from '@sql-editor/types'
import {listQueryAliases, preferredAlias} from '@sql-editor/utils/alias'
import {columnDetail, columnsForTable} from '@sql-editor/utils/schema-columns'
import {buildExpandedColumnList} from '@sql-editor/utils/expand-columns'
import {filterColumnsForCompletion} from '../schema-column-index'
import {isColumnAlreadySelected, selectedColumnRefs} from '@sql-editor/utils/selected-columns'
import {tablesReferencedInQuery} from '../context'
import type {SqlCompletionContext} from '../context'
import {shouldSuggestAliasComplete, shouldSuggestAliasDotStar, shouldSuggestColumns} from '../suggestion-policy'
import {
    categoryCompletionLabel,
    columnCompletionLabel,
    completionItemKind,
} from '../completion-labels'
import {collectGroupByColumnSuggestions, collectOrderByColumnSuggestions} from '../clause-columns'
import {orderBySelectItems} from '../select-list'
import {buildFilterText, columnFilterText, matchesCompletionPrefix as matchPrefix} from '../filter-text'
import {completionSort} from './sort-state'
import type {SuggestItem, SuggestTextRange} from '../suggest-types'
import {
    columnDetailPrefix,
    columnInsertText,
    columnSortBoost,
    getSchemaContext,
    localeT,
    typeT,
    uniqueTables,
} from './collector-locale'

export function collectAliasDotStar(
    ctx: SqlCompletionContext,
    push: (item: SuggestItem) => void,
    range: SuggestTextRange,
    prefix: string,
    hasTables: boolean,
) {
    if (!shouldSuggestAliasDotStar(ctx.slot, hasTables)) return

    const schema = getSchemaContext()
    const multiTable = tablesReferencedInQuery(ctx).length > 1
    const multiline = !ctx.signals.after_comma
    let index = 0

    for (const {alias, table} of listQueryAliases(ctx.aliases)) {
        const starLabel = `${alias}.*`
        const matchesPrefix =
            !prefix ||
            prefix === '*' ||
            matchPrefix(starLabel, prefix) ||
            matchPrefix(alias, prefix) ||
            matchPrefix('expand', prefix) ||
            matchPrefix('灞曞紑', prefix)
        if (!matchesPrefix) continue

        const cols = columnsForTable(schema, table)
        if (cols.length) {
            const expandLabel = localeT('completion.expand_label', {alias})
            push({
                label: categoryCompletionLabel(expandLabel, typeT('expand')),
                kind: completionItemKind('expand'),
                insertText: buildExpandedColumnList(cols, table, alias, multiTable, multiline),
                detail: localeT('completion.expand_detail', {count: cols.length}),
                filterText: buildFilterText(expandLabel, [alias, table, starLabel, '*', 'expand', '灞曞紑', 'star']),
                range,
                sortText: completionSort('expand', index),
                preselect: index === 0,
            })
            index++
        }

        push({
            label: categoryCompletionLabel(starLabel, typeT('alias')),
            kind: completionItemKind('alias'),
            insertText: starLabel,
            detail: localeT('completion.keep_asterisk', {table}),
            filterText: buildFilterText(starLabel, [alias, table, '*']),
            range,
            sortText: completionSort('alias', index++),
        })
    }
}

export function collectAliasComplete(
    ctx: SqlCompletionContext,
    push: (item: SuggestItem) => void,
    range: SuggestTextRange,
    prefix: string,
    hasTables: boolean,
) {
    if (ctx.slot === 'column_ref') return
    if (!shouldSuggestAliasComplete(ctx.slot, hasTables, ctx.signals.after_complete_column_ref)) return
    let index = 0
    for (const {alias, table} of listQueryAliases(ctx.aliases)) {
        if (!matchPrefix(alias, prefix)) continue
        push({
            label: categoryCompletionLabel(alias, typeT('alias')),
            kind: completionItemKind('alias'),
            insertText: `${alias}.`,
            detail: localeT('completion.alias_arrow', {table}),
            filterText: buildFilterText(alias, [table]),
            command: {id: 'editor.action.triggerSuggest', title: 'Trigger Suggest'},
            range,
            sortText: completionSort('alias', index++),
        })
    }
}

export function collectColumnSuggestions(
    ctx: SqlCompletionContext,
    push: (item: SuggestItem) => void,
    range: SuggestTextRange,
    prefix: string,
    hasTables: boolean,
) {
    if (!shouldSuggestColumns(ctx.slot, hasTables, ctx.signals.after_complete_column_ref)) return

    if (ctx.slot === 'group_by') {
        collectGroupByColumnSuggestions(ctx, push, range, prefix)
        return
    }
    if (ctx.slot === 'order_by') {
        collectOrderByColumnSuggestions(ctx, push, range, prefix)
        // SELECT * 等无具体 SELECT 项时，回退到 FROM 表字段（ORDER BY 可用底层列）
        if (orderBySelectItems(ctx.segment).length > 0) return
    }

    const schema = getSchemaContext()
    let index = 0
    const chainComma = ctx.signals.after_comma && !prefix
    const alreadySelected = selectedColumnRefs(ctx.segment, ctx.slot)

    if (ctx.slot === 'column_ref' && ctx.resolvedTable) {
        const colPrefix = ctx.columnPrefix?.toLowerCase() ?? prefix.toLowerCase()
        const detailPrefix = columnDetailPrefix(ctx, ctx.resolvedTable)
        const cols = columnsForTable(schema, ctx.resolvedTable)

        if (colPrefix === '*' && ctx.qualifier && cols.length) {
            const multiTable = tablesReferencedInQuery(ctx).length > 1
            const expandLabel = localeT('completion.expand_label', {alias: ctx.qualifier})
            push({
                label: categoryCompletionLabel(expandLabel, typeT('expand')),
                kind: completionItemKind('expand'),
                insertText: buildExpandedColumnList(cols, ctx.resolvedTable, ctx.qualifier, multiTable, false),
                detail: localeT('completion.expand_detail', {count: cols.length}),
                filterText: buildFilterText(expandLabel, [ctx.qualifier, ctx.resolvedTable, '*', 'expand']),
                range,
                sortText: completionSort('expand', 0),
                preselect: true,
            })
            return
        }

        let first = true
        for (const meta of filterColumnsForCompletion(cols, colPrefix)) {
            const detail = columnDetail(meta)
            push({
                label: columnCompletionLabel(meta.name, meta, typeT('column')),
                kind: completionItemKind('column'),
                insertText: meta.name,
                detail: detail || localeT('completion.type.column'),
                documentation: meta.comment ?? localeT('completion.table_doc', {table: ctx.resolvedTable}),
                filterText: columnFilterText(meta.name),
                range,
                sortText: completionSort('column', 100 + columnSortBoost(meta, ctx.resolvedTable, ctx, schema, alreadySelected) + index++),
                preselect: first,
            })
            first = false
        }
        return
    }

    const tables = uniqueTables(tablesReferencedInQuery(ctx))
    const multiTable = tables.length > 1
    const pushedColumns = new Set<string>()
    const entries: { meta: SqlColumnMeta; table: string; sort: number }[] = []

    for (const table of tables) {
        for (const meta of filterColumnsForCompletion(columnsForTable(getSchemaContext(), table), prefix)) {
            const key = multiTable ? `${table}:${meta.name.toLowerCase()}` : meta.name.toLowerCase()
            if (pushedColumns.has(key)) continue
            pushedColumns.add(key)
            entries.push({
                meta,
                table,
                sort: columnSortBoost(meta, table, ctx, schema, alreadySelected) + index++,
            })
        }
    }

    entries.sort((a, b) => a.sort - b.sort || a.meta.name.localeCompare(b.meta.name))

    let first = chainComma
    for (const {meta, table, sort} of entries) {
        const alias = preferredAlias(table, ctx.aliases)
        const insertText = columnInsertText(meta.name, table, ctx, chainComma)
        if (isColumnAlreadySelected(meta.name, insertText, alreadySelected)) continue
        const detail = columnDetail(meta)
        const tableSource = multiTable ? alias : undefined
        push({
            label: columnCompletionLabel(meta.name, meta, typeT('column'), tableSource),
            kind: completionItemKind('column'),
            insertText,
            detail: detail || localeT('completion.type.column'),
            filterText: columnFilterText(meta.name),
            range,
            sortText: completionSort('column', 100 + sort),
            preselect: first,
            command: chainComma
                ? {id: 'editor.action.triggerSuggest', title: 'Trigger Suggest'}
                : undefined,
        })
        first = false
    }
}

export function collectStarExpansion(
    ctx: SqlCompletionContext,
    push: (item: SuggestItem) => void,
    range: SuggestTextRange,
    prefix: string,
    hasTables: boolean,
) {
    if (!hasTables) return
    if (ctx.slot === 'group_by' || ctx.slot === 'order_by') return

    const schema = getSchemaContext()
    const tables = tablesReferencedInQuery(ctx)
    const multiTable = tables.length > 1
    const multiline = ctx.slot === 'select_list' && !ctx.signals.after_comma
    const wantStar = prefix === '*' || ctx.columnPrefix === '*'

    const pushExpand = (alias: string, table: string, index: number, preselect = false) => {
        const cols = columnsForTable(schema, table)
        if (!cols.length) return
        const insertText = buildExpandedColumnList(cols, table, alias, multiTable, multiline)
        const label = localeT('completion.expand_label', {alias})
        push({
            label: categoryCompletionLabel(label, typeT('expand')),
            kind: completionItemKind('expand'),
            insertText,
            detail: localeT('completion.expand_detail_short', {count: cols.length, table}),
            filterText: buildFilterText(label, [alias, table, insertText, 'expand', 'star']),
            range,
            sortText: completionSort('expand', index),
            preselect,
        })
    }

    if (ctx.slot === 'column_ref' && ctx.resolvedTable && ctx.qualifier && wantStar) {
        pushExpand(ctx.qualifier, ctx.resolvedTable, 0, true)
        return
    }

    if (ctx.slot !== 'select_list') return
    if (!wantStar && prefix) return

    let index = 0
    const aliasEntries = listQueryAliases(ctx.aliases)
    if (aliasEntries.length > 0) {
        for (const {alias, table} of aliasEntries) {
            pushExpand(alias, table, index++, index === 0 && wantStar)
        }
        return
    }

    if (tables.length === 1) {
        const table = tables[0]
        const alias = preferredAlias(table, ctx.aliases)
        pushExpand(alias, table, 0, wantStar)
    }
}
