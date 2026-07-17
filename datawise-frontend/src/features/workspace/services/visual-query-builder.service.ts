export type VisualJoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'CROSS'

export interface VisualQueryJoin {
    type: VisualJoinType
    table: string
    alias: string
    onLeft: string
    onRight: string
}

export interface VisualQueryColumnRef {
    tableAlias: string
    column: string
}

export interface VisualQueryBuilderState {
    fromTable: string
    fromAlias: string
    joins: VisualQueryJoin[]
    columns: VisualQueryColumnRef[]
    where?: string
    orderBy?: string
    limit?: number | null
}

const IDENT = /^[A-Za-z_][\w$]*$/

/** 简单标识符直出；否则用双引号包裹（跨方言的保守选择） */
export function quoteIdent(name: string): string {
    const trimmed = name.trim()
    if (!trimmed) return trimmed
    if (IDENT.test(trimmed) && !trimmed.includes('.')) return trimmed
    return `"${trimmed.replace(/"/g, '""')}"`
}

export function suggestTableAlias(table: string, used: string[] = []): string {
    const base = tableBaseName(table)
    const letters = base
        .replace(/[^A-Za-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .map((part) => part[0]?.toLowerCase() ?? '')
        .join('')
    let candidate = (letters || 't').slice(0, 3) || 't'
    if (!/^[a-z]/.test(candidate)) candidate = `t${candidate}`
    const usedLower = new Set(used.map((item) => item.toLowerCase()))
    if (!usedLower.has(candidate)) return candidate
    let index = 2
    while (usedLower.has(`${candidate}${index}`)) index += 1
    return `${candidate}${index}`
}

export function tableBaseName(table: string): string {
    const parts = table.split('.')
    return parts[parts.length - 1] ?? table
}

function formatTableRef(table: string, alias: string): string {
    const tableSql = table.includes('.')
        ? table.split('.').map(quoteIdent).join('.')
        : quoteIdent(table)
    const aliasSql = quoteIdent(alias)
    return alias && alias.toLowerCase() !== tableBaseName(table).toLowerCase()
        ? `${tableSql} ${aliasSql}`
        : `${tableSql} ${aliasSql}`
}

function formatColumnRef(ref: VisualQueryColumnRef): string {
    if (ref.column === '*') return `${quoteIdent(ref.tableAlias)}.*`
    return `${quoteIdent(ref.tableAlias)}.${quoteIdent(ref.column)}`
}

/** 根据可视化状态生成 SELECT SQL */
export function buildVisualQuerySql(state: VisualQueryBuilderState): string {
    const fromTable = state.fromTable.trim()
    const fromAlias = state.fromAlias.trim() || suggestTableAlias(fromTable)
    if (!fromTable) return ''

    const selectList = state.columns.length
        ? state.columns.map(formatColumnRef).join(',\n       ')
        : '*'

    const lines = [
        `SELECT ${selectList}`,
        `FROM ${formatTableRef(fromTable, fromAlias)}`,
    ]

    for (const join of state.joins) {
        const table = join.table.trim()
        const alias = join.alias.trim() || suggestTableAlias(table)
        if (!table) continue
        if (join.type === 'CROSS') {
            lines.push(`CROSS JOIN ${formatTableRef(table, alias)}`)
            continue
        }
        const onLeft = join.onLeft.trim()
        const onRight = join.onRight.trim()
        const onClause = onLeft && onRight ? ` ON ${onLeft} = ${onRight}` : ''
        lines.push(`${join.type} JOIN ${formatTableRef(table, alias)}${onClause}`)
    }

    const where = state.where?.trim()
    if (where) lines.push(`WHERE ${where}`)

    const orderBy = state.orderBy?.trim()
    if (orderBy) lines.push(`ORDER BY ${orderBy}`)

    const limit = state.limit
    if (limit != null && Number.isFinite(limit) && limit > 0) {
        lines.push(`LIMIT ${Math.floor(limit)}`)
    }

    return `${lines.join('\n')};`
}

export function createEmptyVisualJoin(
    type: VisualJoinType = 'LEFT',
): VisualQueryJoin {
    return {
        type,
        table: '',
        alias: '',
        onLeft: '',
        onRight: '',
    }
}

export function createEmptyVisualQueryState(): VisualQueryBuilderState {
    return {
        fromTable: '',
        fromAlias: '',
        joins: [],
        columns: [],
        where: '',
        orderBy: '',
        limit: 100,
    }
}
