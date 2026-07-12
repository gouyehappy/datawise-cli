import {extractExecutableLineSql} from './current-line-sql'
import {
    findStatementContainingLine,
    findStatementContainingOffset,
    indexSqlStatements,
    isBlankOrCommentOnlyLine,
    lineContent,
    resolveGutterStatement,
    type SqlStatementSpan,
} from './sql-statement-index'

export type SqlStatementAtCursor = {
    /** trim 后的可执行 SQL */
    sql: string
    /** 语句起始行（1-based，错误行映射锚点） */
    startLine: number
    /** 语句结束行（1-based） */
    endLine: number
    anchorLine: number
}

export type SqlRunGutterStatement = SqlStatementAtCursor & {
    /** 行内执行按钮显示行（语句首行） */
    displayLine: number
}

function spanToAtCursor(span: SqlStatementSpan): SqlStatementAtCursor {
    return {
        sql: span.sql,
        startLine: span.startLine,
        endLine: span.endLine,
        anchorLine: span.anchorLine,
    }
}

function cursorLineContent(sql: string, cursor: number): string {
    const before = sql.slice(0, cursor)
    const lineStart = before.lastIndexOf('\n') + 1
    const lineEnd = sql.indexOf('\n', cursor)
    return sql.slice(lineStart, lineEnd === -1 ? sql.length : lineEnd)
}

function isCommentOnlyCursorLine(sql: string, cursor: number): boolean {
    const line = cursorLineContent(sql, cursor)
    return Boolean(line.trim()) && !extractExecutableLineSql(line) && /^\s*--/.test(line)
}

function offsetAtLine(sql: string, lineNumber: number): number | null {
    const lines = sql.split(/\r?\n/)
    if (lineNumber < 1 || lineNumber > lines.length) return null
    let offset = 0
    for (let i = 0; i < lineNumber - 1; i++) {
        offset += (lines[i]?.length ?? 0) + 1
    }
    const line = lines[lineNumber - 1] ?? ''
    offset += line.length - line.trimStart().length
    return offset
}

/** 光标所在的可执行 SQL 语句（支持多行；忽略字符串/注释内分号） */
export function resolveStatementAtCursor(sql: string, cursorOffset: number): SqlStatementAtCursor | null {
    const cursor = Math.max(0, Math.min(cursorOffset, sql.length))
    if (isCommentOnlyCursorLine(sql, cursor)) return null

    const span = findStatementContainingOffset(indexSqlStatements(sql), cursor)
    return span ? spanToAtCursor(span) : null
}

/** 指定行（1-based）所属的可执行 SQL；空行/纯注释行返回 null */
export function resolveStatementAtLine(sql: string, lineNumber: number): SqlStatementAtCursor | null {
    if (isBlankOrCommentOnlyLine(sql, lineNumber)) return null
    const span = findStatementContainingLine(indexSqlStatements(sql), lineNumber)
    return span ? spanToAtCursor(span) : null
}

/** 行内执行按钮上下文行：光标所在语句优先；仅当光标在空行/注释行时才用 gutter 悬停行 */
export function resolveRunGutterContextLine(
    sql: string,
    cursorLine: number | null,
    hoveredLine: number | null,
): number | null {
    if (cursorLine !== null && !isBlankOrCommentOnlyLine(sql, cursorLine)) {
        if (findStatementContainingLine(indexSqlStatements(sql), cursorLine)) return cursorLine
    }
    if (hoveredLine !== null && !isBlankOrCommentOnlyLine(sql, hoveredLine)) {
        if (findStatementContainingLine(indexSqlStatements(sql), hoveredLine)) return hoveredLine
    }
    return null
}

/** 行内执行按钮：解析整句 SQL，按钮固定在语句首行 */
export function resolveRunGutterStatement(
    sql: string,
    cursorLine: number | null,
    hoveredLine: number | null,
): SqlRunGutterStatement | null {
    const span = resolveGutterStatement(sql, cursorLine, hoveredLine)
    if (!span) return null
    return {...spanToAtCursor(span), displayLine: span.anchorLine}
}
