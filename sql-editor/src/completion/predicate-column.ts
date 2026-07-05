import type {SqlColumnMeta, SqlEditorSchema} from '@sql-editor/types'
import {maskNonCodeRegions} from './sql-scan'

export type PredicateLeftColumn = {
    table: string
    column: string
    meta: SqlColumnMeta
}

function unquoteIdent(value: string): string {
    return value.replace(/^[`"'\[]|[`"'\]]$/g, '')
}

function findColumnMeta(
    table: string,
    column: string,
    knownColumns: Record<string, SqlColumnMeta[]>,
): SqlColumnMeta | null {
    const cols = knownColumns[table] ?? knownColumns[table.toLowerCase()]
    const hit = cols?.find((c) => c.name.toLowerCase() === column.toLowerCase())
    return hit ?? null
}

function resolveTable(
    qualifier: string,
    aliases: Record<string, string>,
    knownTables: string[],
): string | null {
    const key = qualifier.toLowerCase()
    if (aliases[key]) return aliases[key]
    return knownTables.find((t) => t.toLowerCase() === key) ?? null
}

/**
 * 解析谓词左侧列（`alias.col =`、`col LIKE` 等），供值补全与列排序使用。
 */
export function resolvePredicateLeftColumn(
    segment: string,
    aliases: Record<string, string>,
    knownTables: string[],
    schema: SqlEditorSchema,
): PredicateLeftColumn | null {
    const text = maskNonCodeRegions(segment).trimEnd()

    const qualified =
        /(?:^|[\s,(])([`"'\[]?[\w$]+[`"'\]]?)\.([`"'\[]?[\w$]+[`"'\]]?)\s*(?:(?:NOT\s+)?(?:LIKE|IN|IS|BETWEEN)|(?:=|<>|!=|>=|<=|<|>))\s*$/i.exec(
            text,
        )
    if (qualified) {
        const table = resolveTable(unquoteIdent(qualified[1]), aliases, knownTables)
        const column = unquoteIdent(qualified[2])
        if (table) {
            const meta = findColumnMeta(table, column, schema.columns) ?? {name: column}
            return {table, column, meta}
        }
    }

    const unqualified =
        /(?:^|[\s,(])([`"'\[]?[\w$]+[`"'\]]?)\s*(?:(?:NOT\s+)?(?:LIKE|IN|IS|BETWEEN)|(?:=|<>|!=|>=|<=|<|>))\s*$/i.exec(
            text,
        )
    if (unqualified) {
        const column = unquoteIdent(unqualified[1])
        const lower = column.toLowerCase()
        if (/^(and|or|not|where|having|on|set|null|true|false)$/i.test(column)) return null

        for (const table of Object.values(aliases)) {
            const meta = findColumnMeta(table, column, schema.columns)
            if (meta) return {table, column: meta.name, meta}
        }
        for (const table of knownTables) {
            const meta = findColumnMeta(table, column, schema.columns)
            if (meta) return {table, column: meta.name, meta}
        }
        if (Object.keys(aliases).length === 1) {
            const table = Object.values(aliases)[0]
            const meta = findColumnMeta(table, column, schema.columns) ?? {name: column}
            return {table, column, meta}
        }
    }

    return null
}

/** FK 参与列（JOIN ON / WHERE 关联键）排序加权。 */
export function isFkColumn(
    meta: SqlColumnMeta,
    table: string,
    inQueryTables: string[],
    foreignKeys: SqlEditorSchema['foreignKeys'],
): boolean {
    if (!foreignKeys?.length) return false
    const inSet = new Set(inQueryTables.map((t) => t.toLowerCase()))
    const tbl = table.toLowerCase()
    for (const fk of foreignKeys) {
        if (
            fk.fromTable.toLowerCase() === tbl &&
            fk.fromColumn.toLowerCase() === meta.name.toLowerCase() &&
            inSet.has(fk.toTable.toLowerCase())
        ) {
            return true
        }
        if (
            fk.toTable.toLowerCase() === tbl &&
            fk.toColumn.toLowerCase() === meta.name.toLowerCase() &&
            inSet.has(fk.fromTable.toLowerCase())
        ) {
            return true
        }
    }
    return false
}
