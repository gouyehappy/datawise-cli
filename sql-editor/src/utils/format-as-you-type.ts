/**
 * 手写 SQL 时：在子句关键字前自动插入换行，避免单行过长。
 * 纯函数，便于单测；由 SqlMonacoHost 在输入空格后调用。
 */

/** 越长越优先匹配（LEFT JOIN 先于 JOIN） */
const CLAUSE_BREAK_KEYWORDS = [
    'UNION ALL',
    'INNER JOIN',
    'LEFT JOIN',
    'RIGHT JOIN',
    'FULL JOIN',
    'CROSS JOIN',
    'STRAIGHT_JOIN',
    'GROUP BY',
    'ORDER BY',
    'FETCH FIRST',
    'FETCH NEXT',
    'WHERE',
    'FROM',
    'HAVING',
    'LIMIT',
    'OFFSET',
    'UNION',
    'INTERSECT',
    'EXCEPT',
    'JOIN',
    'SET',
    'VALUES',
    'RETURNING',
    'AND',
    'OR',
] as const

/** AND/OR 仅在同行已较长时换行，避免短条件被拆碎 */
const CONNECTOR_BREAK_MIN_PREFIX = 40

export type FormatAsYouTypeBreakPlan = {
    /** 1-based：在关键字起始列插入换行（及可选缩进） */
    insertColumn: number
    /** 插入文本，如 `\n` 或 `\n  ` */
    text: string
    keyword: string
}

function escapeKeywordPattern(keyword: string): string {
    return keyword
        .split(/\s+/)
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('\\s+')
}

/**
 * 当前行（光标前，含刚输入的尾随空格）若以「子句关键字 + 空格」结尾，
 * 且关键字前同行还有内容，则计划在关键字前插入换行。
 */
export function planFormatAsYouTypeBreak(lineBeforeCursor: string): FormatAsYouTypeBreakPlan | null {
    if (!lineBeforeCursor || !/\s$/.test(lineBeforeCursor)) return null

    const body = lineBeforeCursor.replace(/\s+$/, '')
    if (!body) return null

    for (const keyword of CLAUSE_BREAK_KEYWORDS) {
        const pattern = escapeKeywordPattern(keyword)
        const re = new RegExp(`(^|[\\s(,])(${pattern})$`, 'i')
        const match = re.exec(body)
        if (!match?.[2]) continue

        const keywordStart = match.index + match[1].length
        const before = body.slice(0, keywordStart)
        if (!before.trim()) return null

        const upper = keyword.toUpperCase()
        if (
            (upper === 'AND' || upper === 'OR') &&
            before.length < CONNECTOR_BREAK_MIN_PREFIX
        ) {
            return null
        }

        return {
            insertColumn: keywordStart + 1,
            text: upper === 'AND' || upper === 'OR' ? '\n  ' : '\n',
            keyword: match[2],
        }
    }

    return null
}

/**
 * 补全插入用：若同行已有内容，给子句关键字加前导换行；已在行首则去掉多余 `\n`。
 */
export function adjustKeywordInsertNewlines(
    insertText: string,
    lineBeforePrefix: string,
): string {
    if (!insertText.startsWith('\n')) return insertText
    const before = lineBeforePrefix.replace(/\s+$/, '')
    const lastNl = before.lastIndexOf('\n')
    const sameLine = lastNl === -1 ? before : before.slice(lastNl + 1)
    if (!sameLine.trim()) {
        return insertText.replace(/^\n+/, '')
    }
    return insertText
}
