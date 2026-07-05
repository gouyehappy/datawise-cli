import type {SqlColumnMeta} from '@sql-editor/types'

type TableColumnIndex = {
    sorted: SqlColumnMeta[]
    source: SqlColumnMeta[]
}

const indexByColumns = new WeakMap<SqlColumnMeta[], TableColumnIndex>()

function columnIndex(columns: SqlColumnMeta[]): TableColumnIndex {
    const cached = indexByColumns.get(columns)
    if (cached && cached.source === columns) return cached
    const sorted = [...columns].sort((a, b) => a.name.localeCompare(b.name, undefined, {sensitivity: 'base'}))
    const entry = {sorted, source: columns}
    indexByColumns.set(columns, entry)
    return entry
}

function lowerBound(sorted: SqlColumnMeta[], prefix: string): number {
    let lo = 0
    let hi = sorted.length
    while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (sorted[mid].name.toLowerCase() < prefix) lo = mid + 1
        else hi = mid
    }
    return lo
}

/**
 * 宽表列补全：仅前缀匹配（startsWith），禁止子串模糊以免 COUNT → user_count 误命中。
 */
export function filterColumnsForCompletion(columns: SqlColumnMeta[], prefix: string): SqlColumnMeta[] {
    if (!columns.length) return []
    if (!prefix) return columns

    const p = prefix.toLowerCase()
    const {sorted} = columnIndex(columns)
    const result: SqlColumnMeta[] = []

    const start = lowerBound(sorted, p)
    for (let i = start; i < sorted.length; i++) {
        const meta = sorted[i]
        const name = meta.name.toLowerCase()
        if (!name.startsWith(p)) break
        result.push(meta)
    }

    return result
}
