import {isSemicolonInCode} from './sql-literal-scan'
import {extractExecutableLineSql} from './current-line-sql'

export type SqlStatementAtCursor = {
    /** trim 后的可执行 SQL */
    sql: string
    /** 语句起始行（1-based，错误行映射锚点） */
    startLine: number
    /** 语句结束行（1-based） */
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
        if (!line.trim() || /^\s*--/.test(line)) {
            first++
            continue
        }
        break
    }
    let last = lines.length - 1
    while (last >= first) {
        const line = lines[last] ?? ''
        if (!line.trim()) {
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

function cursorInStatement(cursor: number, start: number, end: number): boolean {
    return cursor >= start && cursor <= end
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
    let rawStart = 0

    for (let i = 0; i < sql.length; i++) {
        if (sql[i] !== ';' || !isSemicolonInCode(sql, i)) continue
        if (cursor < rawStart || cursor > i) {
            rawStart = i + 1
            continue
        }

        const bounds = trimStatementBounds(sql.slice(rawStart, i), rawStart)
        if (!bounds || !cursorInStatement(cursor, bounds.start, bounds.end)) return null

        const endLine = offsetToLine(sql, Math.max(bounds.start, bounds.end - 1))
        return {
            sql: bounds.sql,
            startLine: offsetToLine(sql, bounds.start),
            endLine,
            anchorLine: offsetToLine(sql, bounds.start),
        }
    }

    if (cursor < rawStart) return null

    const bounds = trimStatementBounds(sql.slice(rawStart), rawStart)
    if (!bounds || !cursorInStatement(cursor, bounds.start, bounds.end)) return null

    const endLine = offsetToLine(sql, Math.max(bounds.start, bounds.end - 1))
    return {
        sql: bounds.sql,
        startLine: offsetToLine(sql, bounds.start),
        endLine,
        anchorLine: offsetToLine(sql, bounds.start),
    }
}

/** 指定行（1-based）所属的可执行 SQL；空行/纯注释行返回 null */
export function resolveStatementAtLine(sql: string, lineNumber: number): SqlStatementAtCursor | null {
    const lines = sql.split(/\r?\n/)
    if (lineNumber < 1 || lineNumber > lines.length) return null
    const line = lines[lineNumber - 1] ?? ''
    if (!extractExecutableLineSql(line)) return null

    const offset = offsetAtLine(sql, lineNumber)
    if (offset === null) return null
    return resolveStatementAtCursor(sql, offset)
}

/** 行内执行按钮上下文行：光标行优先；光标在空行时才用行号悬停行 */
export function resolveRunGutterContextLine(
    sql: string,
    cursorLine: number | null,
    hoveredLine: number | null,
): number | null {
    if (cursorLine !== null && resolveStatementAtLine(sql, cursorLine)) {
        return cursorLine
    }
    if (hoveredLine !== null && resolveStatementAtLine(sql, hoveredLine)) {
        return hoveredLine
    }
    return null
}

/** 行内执行按钮：解析整句 SQL 与按钮锚点行（语句首行） */
export function resolveRunGutterStatement(
    sql: string,
    cursorLine: number | null,
    hoveredLine: number | null,
): SqlStatementAtCursor | null {
    const contextLine = resolveRunGutterContextLine(sql, cursorLine, hoveredLine)
    if (!contextLine) return null

    const statement = resolveStatementAtLine(sql, contextLine)
    if (!statement?.sql.trim()) return null
    if (contextLine < statement.startLine || contextLine > statement.endLine) return null
    return statement
}
