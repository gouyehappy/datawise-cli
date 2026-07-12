import {isSemicolonInCode} from './sql-literal-scan'
import {extractExecutableLineSql} from './current-line-sql'

/** 一条可执行 SQL 在文档中的行范围 */
export type SqlStatementSpan = {
    sql: string
    startOffset: number
    endOffset: number
    startLine: number
    endLine: number
    anchorLine: number
}

function offsetToLine(sql: string, offset: number): number {
    let line = 1
    const end = Math.max(0, Math.min(offset, sql.length))
    for (let i = 0; i < end; i++) {
        if (sql.charCodeAt(i) === 10) line++
    }
    return line
}

function trimStatementBounds(
    piece: string,
    rawStart: number,
): {sql: string; start: number; end: number} | null {
    const lines = piece.split(/\r?\n/)
    let first = 0
    while (first < lines.length) {
        const line = lines[first] ?? ''
        if (!extractExecutableLineSql(line)) {
            first++
            continue
        }
        break
    }
    let last = lines.length - 1
    while (last >= first) {
        const line = lines[last] ?? ''
        if (!extractExecutableLineSql(line)) {
            last--
            continue
        }
        break
    }
    if (first > last) return null

    const bodyLines = lines.slice(first, last + 1)
    const sql = bodyLines.join('\n').trim()
    if (!sql) return null

    let startInPiece = 0
    for (let i = 0; i < first; i++) {
        startInPiece += (lines[i]?.length ?? 0) + 1
    }
    const body = bodyLines.join('\n')
    startInPiece += body.length - body.trimStart().length
    const endInPiece = startInPiece + sql.length

    return {
        sql,
        start: rawStart + startInPiece,
        end: rawStart + endInPiece,
    }
}

function boundsToSpan(sql: string, bounds: {sql: string; start: number; end: number}): SqlStatementSpan {
    return {
        sql: bounds.sql,
        startOffset: bounds.start,
        endOffset: bounds.end,
        startLine: offsetToLine(sql, bounds.start),
        endLine: offsetToLine(sql, Math.max(bounds.start, bounds.end - 1)),
        anchorLine: offsetToLine(sql, bounds.start),
    }
}

/** 将文档拆分为带行号的可执行语句列表（忽略字符串/注释内分号） */
export function indexSqlStatements(sql: string): SqlStatementSpan[] {
    const spans: SqlStatementSpan[] = []
    let rawStart = 0

    for (let i = 0; i < sql.length; i++) {
        if (sql[i] !== ';' || !isSemicolonInCode(sql, i)) continue

        const bounds = trimStatementBounds(sql.slice(rawStart, i), rawStart)
        if (bounds) spans.push(boundsToSpan(sql, bounds))
        rawStart = i + 1
    }

    const tail = trimStatementBounds(sql.slice(rawStart), rawStart)
    if (tail) spans.push(boundsToSpan(sql, tail))

    return spans
}

export function findStatementContainingLine(
    statements: SqlStatementSpan[],
    lineNumber: number,
): SqlStatementSpan | null {
    for (const statement of statements) {
        if (lineNumber >= statement.startLine && lineNumber <= statement.endLine) {
            return statement
        }
    }
    return null
}

export function findStatementContainingOffset(
    statements: SqlStatementSpan[],
    offset: number,
): SqlStatementSpan | null {
    for (const statement of statements) {
        if (offset >= statement.startOffset && offset <= statement.endOffset) {
            return statement
        }
    }
    return null
}

export function lineContent(sql: string, lineNumber: number): string {
    const lines = sql.split(/\r?\n/)
    return lines[lineNumber - 1] ?? ''
}

/** 空行或纯注释行（不含可执行片段） */
export function isBlankOrCommentOnlyLine(sql: string, lineNumber: number): boolean {
    return !extractExecutableLineSql(lineContent(sql, lineNumber))
}

/**
 * 行内执行按钮：解析当前应高亮的语句。
 * - 光标在可执行行 → 该语句
 * - 光标在空行/纯注释行 → 仅当 gutter 悬停在可执行行时取该语句
 */
export function resolveGutterStatement(
    sql: string,
    cursorLine: number | null,
    gutterLine: number | null,
): SqlStatementSpan | null {
    const statements = indexSqlStatements(sql)

    if (cursorLine !== null && !isBlankOrCommentOnlyLine(sql, cursorLine)) {
        const fromCursor = findStatementContainingLine(statements, cursorLine)
        if (fromCursor) return fromCursor
    }

    if (gutterLine !== null && !isBlankOrCommentOnlyLine(sql, gutterLine)) {
        return findStatementContainingLine(statements, gutterLine)
    }

    return null
}
