import type {SqlEditorSchema} from '@sql-editor/types'
import {
    catalogUsesSchemaLevel,
    parseFromJoinQualifiedInput,
    resolveSchemasForCatalogKey,
    resolveTableScopeFromSegments,
} from '@sql-editor/utils/from-qualified-input'
import {resolveDatabaseScopeEntry} from '@sql-editor/utils/qualified-database-scopes'
import type {SqlCompletionContext} from '../context'
import {
    categoryCompletionLabel,
    completionItemKind,
    tableCompletionLabel,
} from '../completion-labels'
import {buildFilterText} from '../filter-text'
import {completionSort} from './sort-state'
import type {SuggestPush, SuggestTextRange} from '../suggest-types'
import {localeT} from './collector-locale'

/** @deprecated use parseFromJoinQualifiedInput */
export function parseQualifiedTablePrefix(tablePrefix: string): {
    parts: string[]
    trailingDot: boolean
} {
    const parsed = parseFromJoinQualifiedInput(tablePrefix)
    return {parts: parsed.segments, trailingDot: parsed.trailingDot}
}

function resolveTablesForScope(schema: SqlEditorSchema, databaseScope: string): string[] {
    const bundle = resolveDatabaseScopeEntry(schema.tablesByDatabase, databaseScope)
    return bundle?.tables ?? []
}

function matchesLocalPrefix(value: string, localPartial: string): boolean {
    if (!localPartial) return true
    return value.toLowerCase().startsWith(localPartial.toLowerCase())
}

function pushCatalogSuggestions(
    schema: SqlEditorSchema,
    push: SuggestPush,
    range: SuggestTextRange,
    prefix: string,
    localPartial: string,
    startIndex: number,
): number {
    let index = startIndex
    for (const catalog of schema.catalogs ?? []) {
        if (!matchesLocalPrefix(catalog, localPartial || prefix)) continue
        push({
            label: categoryCompletionLabel(catalog, localeT('completion.type.catalog')),
            kind: completionItemKind('table'),
            insertText: catalog,
            detail: localeT('completion.type.catalog'),
            filterText: buildFilterText(catalog, ['catalog']),
            range,
            sortText: completionSort('table', index++),
            preselect: index === startIndex + 1,
        })
    }
    return index
}

function pushSchemaSuggestions(
    schema: SqlEditorSchema,
    push: SuggestPush,
    range: SuggestTextRange,
    catalog: string,
    localPartial: string,
    startIndex: number,
): number {
    let index = startIndex
    for (const schemaName of resolveSchemasForCatalogKey(schema.schemasByCatalog, catalog)) {
        if (!matchesLocalPrefix(schemaName, localPartial)) continue
        push({
            label: categoryCompletionLabel(schemaName, localeT('completion.type.schema')),
            kind: completionItemKind('alias'),
            insertText: schemaName,
            detail: `${catalog}.${schemaName}`,
            filterText: buildFilterText(schemaName, [catalog, 'schema']),
            range,
            sortText: completionSort('table', index++),
            preselect: index === startIndex + 1,
        })
    }
    return index
}

function pushTableSuggestionsForScope(
    schema: SqlEditorSchema,
    push: SuggestPush,
    range: SuggestTextRange,
    databaseScope: string,
    localPartial: string,
    startIndex: number,
): number {
    let index = startIndex
    for (const table of resolveTablesForScope(schema, databaseScope)) {
        if (!matchesLocalPrefix(table, localPartial)) continue
        push({
            label: tableCompletionLabel(table, localeT('completion.type.table'), undefined, databaseScope),
            kind: completionItemKind('table'),
            insertText: table,
            detail: databaseScope,
            filterText: buildFilterText(table, [databaseScope, localPartial]),
            range,
            sortText: completionSort('table', index++),
            preselect: index === startIndex + 1,
        })
    }
    return index
}

export function collectCatalogSchemaSuggestions(
    ctx: SqlCompletionContext,
    push: SuggestPush,
    range: SuggestTextRange,
    prefix: string,
    schema: SqlEditorSchema,
) {
    if (ctx.slot !== 'from' && ctx.slot !== 'join') return
    if (!schema.catalogs?.length) return

    const qualifiedInput = ctx.fromJoin?.tablePrefix || prefix
    const {segments, trailingDot, localPartial} = parseFromJoinQualifiedInput(qualifiedInput)
    let index = 0

    // FROM → catalog
    if (segments.length === 0) {
        pushCatalogSuggestions(schema, push, range, prefix, localPartial || prefix, index)
        return
    }

    const catalog = segments[0]

    // FROM hive / hive（未带点）
    if (segments.length === 1 && !trailingDot) {
        pushCatalogSuggestions(schema, push, range, prefix, catalog, index)
        return
    }

    // FROM hive. 或 admin_db.
    if (segments.length === 1 && trailingDot) {
        if (catalogUsesSchemaLevel(schema, catalog)) {
            pushSchemaSuggestions(schema, push, range, catalog, localPartial, index)
            return
        }
        pushTableSuggestionsForScope(schema, push, range, catalog, localPartial, index)
        return
    }

    // FROM hive.a003 或 admin_db.users
    if (segments.length === 2 && !trailingDot) {
        if (catalogUsesSchemaLevel(schema, catalog)) {
            pushSchemaSuggestions(schema, push, range, catalog, segments[1], index)
            return
        }
        const scope = resolveTableScopeFromSegments(schema, segments)
        if (scope) {
            pushTableSuggestionsForScope(schema, push, range, scope, segments[1], index)
        }
        return
    }

    // FROM hive.a003.
    if (segments.length === 2 && trailingDot) {
        const databaseScope = `${segments[0]}.${segments[1]}`
        pushTableSuggestionsForScope(schema, push, range, databaseScope, localPartial, index)
        return
    }

    // FROM hive.a003.table 或 admin_db.users
    if (segments.length >= 3) {
        if (catalogUsesSchemaLevel(schema, catalog)) {
            const databaseScope = `${segments[0]}.${segments[1]}`
            const tablePartial = segments.slice(2).join('.')
            pushTableSuggestionsForScope(schema, push, range, databaseScope, tablePartial, index)
            return
        }
        const scope = resolveTableScopeFromSegments(schema, segments)
        if (scope) {
            const tablePartial = segments.slice(1).join('.')
            pushTableSuggestionsForScope(schema, push, range, scope, tablePartial, index)
        }
    }
}
