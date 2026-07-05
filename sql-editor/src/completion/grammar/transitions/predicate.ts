import type {SqlCompletionSlot} from '@sql-editor/types'
import {sqlScanModeAt} from '../../sql-scan'

/** 谓词右值：引号字面量 / 标识符 / 数字 */
const LITERAL_VALUE_SRC =
    "(?:'(?:[^']|'')*'|\"(?:[^\"]|\"\")*\"|[\\w$]+(?:\\.[\\w$]+)?|\\d+(?:\\.\\d+)?)"
const COLUMN_SRC = '(?:[\\w$]+\\.)?[\\w$]+'
const EQ_PREDICATE_SRC = `${COLUMN_SRC}\\s*=\\s*${LITERAL_VALUE_SRC}`

function stripTrailingKeywordPrefix(tail: string): string {
    return tail.replace(/\s+[A-Za-z_][\w$]*$/, '').trimEnd()
}

function endsWithCompleteEqualityChain(tail: string, clauseKeyword: string): boolean {
    const stripped = stripTrailingKeywordPrefix(tail)
    if (!stripped) return false
    const re = new RegExp(
        `\\b${clauseKeyword}\\s+${EQ_PREDICATE_SRC}(?:\\s+(?:AND|OR)\\s+${EQ_PREDICATE_SRC})*\\s*$`,
        'i',
    )
    return re.test(stripped)
}

export function segmentEndsWithOperator(segment: string): boolean {
    const tail = segment.trimEnd()
    if (/[\w$.)]\s*(=|<>|!=|>=|<=|<|>)\s*$/i.test(tail)) return true
    if (/\b(IS\s+NOT\s+NULL|IS\s+NULL|NOT\s+IN|NOT\s+LIKE)\s*$/i.test(tail)) return true
    if (/\b(IN|LIKE|BETWEEN|EXISTS)\s+\S/i.test(tail.slice(-40))) return true
    return false
}

/** ON 条件已完整，或正在输入下一子句 / AND/OR 前缀 */
export function detectAfterCompleteOnPredicate(segment: string, slot: SqlCompletionSlot): boolean {
    if (slot !== 'on') return false
    const tail = segment.trimEnd()
    if (segmentEndsWithOperator(tail)) return false
    if (/\b(AND|OR)\s*$/i.test(tail)) return false
    return endsWithCompleteEqualityChain(tail, 'ON')
}

/** WHERE/HAVING 条件已完整，或正在输入 AND/OR / GROUP BY 等前缀 */
export function detectAfterCompleteWherePredicate(segment: string, slot: SqlCompletionSlot): boolean {
    if (slot !== 'where' && slot !== 'having') return false
    const tail = segment.trimEnd()
    if (segmentEndsWithOperator(tail)) return false
    if (/\b(AND|OR)\s*$/i.test(tail)) return false
    const clause = slot === 'having' ? 'HAVING' : 'WHERE'
    return endsWithCompleteEqualityChain(tail, clause)
}

/**
 * 光标刚越过语句结束分号（行尾空白）时，用分号前的片段做槽位与谓词判断。
 */
export function completionSegmentAtOffset(
    sql: string,
    offset: number,
    bounds: { start: number; end: number },
): { segment: string; offsetInSegment: number; afterStatementSemicolon: boolean } {
    const offsetInSegment = offset - bounds.start
    const segment = sql.slice(bounds.start, offset)

    if (segment.trim() !== '' || bounds.start <= 0) {
        return {segment, offsetInSegment, afterStatementSemicolon: false}
    }

    const semicolonIndex = bounds.start - 1
    if (sql[semicolonIndex] !== ';' || sqlScanModeAt(sql, semicolonIndex) !== 'code') {
        return {segment, offsetInSegment, afterStatementSemicolon: false}
    }

    let prevStart = 0
    for (let i = 0; i < semicolonIndex; i++) {
        if (sql[i] === ';' && sqlScanModeAt(sql, i) === 'code') prevStart = i + 1
    }

    const prevSegment = sql.slice(prevStart, semicolonIndex)
    return {
        segment: prevSegment,
        offsetInSegment: prevSegment.length,
        afterStatementSemicolon: true,
    }
}
