import type {SqlColumnMeta, SqlEditorSchema, SqlForeignKey} from '@sql-editor/types'

/** 归一化列定义（兼容旧版 string[]） */
export function normalizeColumnMeta(columns: SqlColumnMeta[] | string[] | undefined): SqlColumnMeta[] {
    if (!columns?.length) return []
    if (typeof columns[0] === 'string') {
        return (columns as string[]).map((name) => ({name}))
    }
    return columns as SqlColumnMeta[]
}

export function columnNames(columns: SqlColumnMeta[] | string[] | undefined): string[] {
    return normalizeColumnMeta(columns).map((col) => col.name)
}

export function columnsForTable(schema: SqlEditorSchema, table: string): SqlColumnMeta[] {
    const direct = schema.columns[table]
    if (direct?.length) return normalizeColumnMeta(direct)
    const hit = Object.entries(schema.columns).find(
        ([name]) => name.toLowerCase() === table.toLowerCase(),
    )
    return normalizeColumnMeta(hit?.[1])
}

export function columnDetail(meta: SqlColumnMeta): string {
    const parts: string[] = []
    if (meta.type) parts.push(meta.type)
    if (meta.pk) parts.push('PK')
    if (meta.comment) parts.push(meta.comment)
    return parts.join(' · ')
}

/** 表所属 catalog / 库名（用于补全展示） */
export function catalogForTable(schema: SqlEditorSchema, table: string): string | undefined {
    const direct = schema.tableCatalogs?.[table]
    if (direct) return direct
    const hit = Object.entries(schema.tableCatalogs ?? {}).find(
        ([name]) => name.toLowerCase() === table.toLowerCase(),
    )
    return hit?.[1]
}

export function findTableKey(schema: SqlEditorSchema, table: string): string | null {
    if (schema.columns[table]) return table
    const hit = Object.keys(schema.columns).find((name) => name.toLowerCase() === table.toLowerCase())
    return hit ?? null
}

export function findColumnMeta(
    schema: SqlEditorSchema,
    table: string,
    column: string,
): SqlColumnMeta | null {
    const cols = columnsForTable(schema, table)
    return cols.find((c) => c.name.toLowerCase() === column.toLowerCase()) ?? null
}

export function columnEnumValues(meta: SqlColumnMeta | null | undefined): string[] {
    if (!meta?.enumValues?.length) return []
    return meta.enumValues.filter((v) => v.length > 0)
}

/** 与当前查询中已引用表有 FK 关系的候选表（JOIN 优先） */
export function relatedTablesForJoin(schema: SqlEditorSchema, inQuery: string[]): string[] {
    const inSet = new Set(inQuery.map((t) => t.toLowerCase()))
    const related = new Set<string>()
    for (const fk of schema.foreignKeys ?? []) {
        if (inSet.has(fk.fromTable.toLowerCase())) related.add(fk.toTable)
        if (inSet.has(fk.toTable.toLowerCase())) related.add(fk.fromTable)
    }
    return [...related]
}

/** 两表之间的 FK 等值条件（ON 子句） */
export function fkJoinConditions(
    schema: SqlEditorSchema,
    tableA: string,
    aliasA: string,
    tableB: string,
    aliasB: string,
): string[] {
    const results: string[] = []
    const a = tableA.toLowerCase()
    const b = tableB.toLowerCase()
    for (const fk of schema.foreignKeys ?? []) {
        const from = fk.fromTable.toLowerCase()
        const to = fk.toTable.toLowerCase()
        if (from === a && to === b) {
            results.push(`${aliasA}.${fk.fromColumn} = ${aliasB}.${fk.toColumn}`)
        } else if (from === b && to === a) {
            results.push(`${aliasB}.${fk.fromColumn} = ${aliasA}.${fk.toColumn}`)
        }
    }
    return results
}

export function mergeForeignKeys(
    existing: SqlForeignKey[],
    incoming: SqlForeignKey[],
): SqlForeignKey[] {
    const seen = new Set(existing.map((fk) => fkKey(fk)))
    const merged = [...existing]
    for (const fk of incoming) {
        const key = fkKey(fk)
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(fk)
    }
    return merged
}

function fkKey(fk: SqlForeignKey): string {
    return `${fk.fromTable}.${fk.fromColumn}->${fk.toTable}.${fk.toColumn}`.toLowerCase()
}
