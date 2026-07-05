import type {SqlCompletionSlot} from '@sql-editor/types'


/** 补全列表排序：列优先 / 关键字优先 / 表优先 */

export type CompletionSortProfile = 'column-first' | 'keyword-first' | 'table-first'


/**

 * 关键字展示阶段（grammar 回退时仍使用）：

 * - none：不展示关键字（如 ON 后应先选列）

 * - operators：比较符（=、<>、LIKE…）

 * - sort-direction：ORDER BY 列后的 ASC / DESC

 * - connectors：AND / OR

 * - clause-next：下一子句（WHERE、JOIN、ORDER BY…）

 * - join-on-only：JOIN 右表已定，仅 ON

 * - all：槽位默认全集

 */

export type KeywordPhase =

    | 'none'

    | 'operators'

    | 'sort-direction'

    | 'connectors'

    | 'clause-next'

    | 'clause-prefix'

    | 'join-on-only'

    | 'function-open'

    | 'all'


const OPERATOR_KEYWORDS = new Set(['=', '<>', '!=', '>=', '<=', '<', '>', 'LIKE', 'IN', 'IS', 'BETWEEN', 'EXISTS', 'NOT'])

const SORT_DIRECTION_KEYWORDS = new Set(['ASC', 'DESC'])

const CONNECTOR_KEYWORDS = new Set(['AND', 'OR'])

/** 下一子句 / SELECT 列表内输入子句前缀时允许的关键字 */
const CLAUSE_NEXT_KEYWORDS = new Set([
    'FROM',
    'WHERE',
    'JOIN',
    'INNER JOIN',
    'LEFT JOIN',
    'RIGHT JOIN',
    'FULL JOIN',
    'CROSS JOIN',
    'STRAIGHT_JOIN',
    'INNER',
    'LEFT',
    'RIGHT',
    'FULL',
    'CROSS',
    'GROUP BY',
    'GROUP',
    'ORDER BY',
    'ORDER',
    'HAVING',
    'LIMIT',
    'OFFSET',
    'UNION',
    'UNION ALL',
    'INTERSECT',
    'EXCEPT',
    'AND',
    'OR',
])

function normalizeClauseKeyword(keyword: string): string {
    return keyword.trim().replace(/\s+/g, ' ').toUpperCase()
}

function isClauseNextKeyword(keyword: string): boolean {
    return CLAUSE_NEXT_KEYWORDS.has(normalizeClauseKeyword(keyword))
}

/** clause-next 阶段关键字排序：WHERE 优先于 LEFT/RIGHT 等 JOIN 限定词 */
const CLAUSE_NEXT_ORDER = [
    'FROM',
    'WHERE',
    'INNER JOIN',
    'LEFT JOIN',
    'RIGHT JOIN',
    'FULL JOIN',
    'CROSS JOIN',
    'STRAIGHT_JOIN',
    'JOIN',
    'GROUP BY',
    'ORDER BY',
    'HAVING',
    'LIMIT',
    'OFFSET',
    'UNION ALL',
    'UNION',
    'INTERSECT',
    'EXCEPT',
    'INNER',
    'LEFT',
    'RIGHT',
    'FULL',
    'CROSS',
    'GROUP',
    'ORDER',
]

export function sortClauseNextKeywords(keywords: string[]): string[] {
    const orderIndex = (keyword: string) => {
        const upper = normalizeClauseKeyword(keyword)
        const idx = CLAUSE_NEXT_ORDER.indexOf(upper)
        return idx === -1 ? CLAUSE_NEXT_ORDER.length + upper.charCodeAt(0) : idx
    }
    return [...keywords].sort((a, b) => {
        const diff = orderIndex(a) - orderIndex(b)
        return diff !== 0 ? diff : a.localeCompare(b)
    })
}

export function sortTextForProfile(
    profile: CompletionSortProfile,
    group: 'keyword' | 'snippet' | 'column' | 'alias' | 'table' | 'fkjoin' | 'expand' | 'ai' | 'function',
    index = 0,
): string {

    const tiers =

        profile === 'keyword-first'

            ? {keyword: 0, function: 300, snippet: 500, expand: 800, ai: 900, fkjoin: 1000, column: 1500, alias: 2000, table: 2500}

            : profile === 'table-first'

                ? {table: 0, fkjoin: 500, column: 1000, function: 1200, alias: 1500, expand: 1800, ai: 1900, snippet: 2000, keyword: 2500}

                : {fkjoin: 0, column: 100, function: 220, expand: 300, alias: 500, table: 800, snippet: 1500, ai: 1800, keyword: 2000}

    return String((tiers[group] ?? 0) + index).padStart(4, '0')

}


export function filterKeywordsByPhase(keywords: string[], phase: KeywordPhase): string[] {

    if (phase === 'none') return []

    if (phase === 'all') return keywords

    if (phase === 'join-on-only') return keywords.filter((k) => k.toUpperCase() === 'ON')

    if (phase === 'function-open') return keywords.filter((k) => k === '(')

    if (phase === 'clause-next' || phase === 'clause-prefix') return keywords.filter(isClauseNextKeyword)

    if (phase === 'connectors') {

        return keywords.filter((k) => CONNECTOR_KEYWORDS.has(k.toUpperCase()))

    }

    if (phase === 'sort-direction') {

        return keywords.filter((k) => SORT_DIRECTION_KEYWORDS.has(k.toUpperCase()))

    }

    return keywords.filter((k) => {

        const upper = k.toUpperCase()

        if (OPERATOR_KEYWORDS.has(upper)) return true

        if (upper === 'IS NOT NULL' || upper === 'NULL') return true

        return false

    })

}


export function shouldOfferSnippetsForPlan(
    plan: Pick<{ keywordPhase: KeywordPhase; keywordSlot?: string }, 'keywordPhase' | 'keywordSlot'>,
    slot: SqlCompletionSlot,
): boolean {

    if (plan.keywordPhase === 'none') {

        return slot === 'statement_start' || slot === 'from' || slot === 'join'

    }

    if (plan.keywordPhase === 'clause-next') return true

    return plan.keywordPhase === 'all'

}

