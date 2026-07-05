import type * as monaco from 'monaco-editor'
import type {SqlCompletionContext} from './context'
import type {SqlCompletionSlot} from '@sql-editor/types'
import {
    fromJoinQualifiedLocalPartial,
    fromJoinQualifiedUsesCursorInsert,
} from '@sql-editor/utils/from-qualified-input'

const CLAUSE_COLUMN_SLOTS: Partial<Record<SqlCompletionSlot, string>> = {
    on: 'ON',
    where: 'WHERE',
    having: 'HAVING',
}

/** ON / WHERE / HAVING 后正在输入的列前缀（不含子句关键字本身） */
export function prefixAfterClauseKeyword(lineBefore: string, clauseKeyword: string): string | null {
    const re = new RegExp(`\\b${clauseKeyword.replace(/\s+/g, '\\s+')}\\s*([\\w$.]*)$`, 'i')
    const match = re.exec(lineBefore)
    if (!match) return null
    return match[1] ?? ''
}

function clauseColumnInput(
    slot: SqlCompletionSlot,
    lineBefore: string,
): { partial: string } | null {
    const keyword = CLAUSE_COLUMN_SLOTS[slot]
    if (!keyword) return null
    const partial = prefixAfterClauseKeyword(lineBefore, keyword)
    if (partial === null) return null
    return {partial}
}

function cursorInsertRange(position: monaco.Position): monaco.IRange {
    return {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column,
        endColumn: position.column,
    }
}

function fromJoinTablePartial(before: string): string | null {
    const match =
        before.match(/(?:FROM|JOIN)\s+([`"']?[\w$]+(?:\.[`"']?[\w$]+)*)$/i) ??
        before.match(/(?:INNER|LEFT|RIGHT|FULL|CROSS)\s+JOIN\s+([`"']?[\w$]+(?:\.[`"']?[\w$]+)*)$/i)
    if (!match) return null
    return match[1]?.replace(/^[`"']|[`"']$/g, '') ?? ''
}

function fromJoinCompletionRange(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    partial: string,
): monaco.IRange {
    if (partial.includes('.')) {
        if (fromJoinQualifiedUsesCursorInsert(partial)) {
            return cursorInsertRange(position)
        }
        const local = fromJoinQualifiedLocalPartial(partial)
        return {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - local.length,
            endColumn: position.column,
        }
    }
    return {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - partial.length,
        endColumn: position.column,
    }
}

function lineBefore(model: monaco.editor.ITextModel, position: monaco.Position): string {
    return model.getLineContent(position.lineNumber).slice(0, position.column - 1)
}

/** SELECT 列表中的 `*`（Monaco 不把 * 当作 word） */
export function selectListStarBeforeCursor(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
): boolean {
    return /\*(?:\s*)$/.test(lineBefore(model, position))
}

/** 补全替换范围：column_ref 时只替换点号后的字段前缀 */
export function completionRange(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    ctx: SqlCompletionContext,
): monaco.IRange {
    if (ctx.slot === 'column_ref') {
        const before = lineBefore(model, position)
        const dotMatch = before.match(/([\w$`"']+)\.(\*|\w*)$/)
        if (dotMatch) {
            const partial = dotMatch[2] ?? ''
            return {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column - partial.length,
                endColumn: position.column,
            }
        }
    }

    if (ctx.slot === 'select_list' && selectListStarBeforeCursor(model, position)) {
        return {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - 1,
            endColumn: position.column,
        }
    }

    if (ctx.slot === 'from' || ctx.slot === 'join') {
        const partial = fromJoinTablePartial(lineBefore(model, position))
        if (partial !== null) {
            return fromJoinCompletionRange(model, position, partial)
        }
    }

    const clauseInput = clauseColumnInput(ctx.slot, lineBefore(model, position))
    if (clauseInput) {
        const {partial} = clauseInput
        return {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - partial.length,
            endColumn: position.column,
        }
    }

    const word = model.getWordUntilPosition(position)
    return {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
    }
}

/** 当前正在输入的补全前缀（大小写不敏感匹配） */
export function completionPrefix(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    ctx?: SqlCompletionContext,
): string {
    if (ctx?.slot === 'column_ref') {
        return ctx.columnPrefix ?? ''
    }

    if (ctx?.slot === 'select_list' && selectListStarBeforeCursor(model, position)) {
        return '*'
    }

    if (ctx?.slot === 'from' || ctx?.slot === 'join') {
        const partial = fromJoinTablePartial(lineBefore(model, position))
        if (partial !== null) {
            if (partial.includes('.')) {
                return fromJoinQualifiedLocalPartial(partial)
            }
            return partial
        }
    }

    if (ctx?.signals.after_complete_where_predicate || ctx?.signals.after_complete_on_predicate) {
        return model.getWordUntilPosition(position).word
    }

    if (ctx?.slot) {
        const clauseInput = clauseColumnInput(ctx.slot, lineBefore(model, position))
        if (clauseInput) return clauseInput.partial
    }

    return model.getWordUntilPosition(position).word
}

/** 表名已选定后：光标处插入，前缀不参与过滤（JOIN 限定词输入时保留前缀） */
export function effectiveCompletionInput(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    ctx: SqlCompletionContext,
): { range: monaco.IRange; prefix: string } {
    const range = completionRange(model, position, ctx)
    let prefix = completionPrefix(model, position, ctx)

    if (ctx.signals.after_complete_where_predicate || ctx.signals.after_complete_on_predicate) {
        const word = model.getWordUntilPosition(position)
        return {
            range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            },
            prefix: word.word,
        }
    }

    if (ctx.fromJoin?.joinKeywordPrefix) {
        const partial = ctx.fromJoin.joinKeywordPrefix
        return {
            range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column - partial.length,
                endColumn: position.column,
            },
            prefix: partial,
        }
    }

    if (ctx.fromJoin?.clauseKeywordPrefix) {
        const partial = ctx.fromJoin.clauseKeywordPrefix
        return {
            range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column - partial.length,
                endColumn: position.column,
            },
            prefix: partial,
        }
    }

    if (ctx.fromJoin?.awaitingTableName || ctx.fromJoin?.awaitingJoinTable) {
        return {
            range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column,
                endColumn: position.column,
            },
            prefix: '',
        }
    }

    if (ctx.fromJoin?.tableClauseComplete && !ctx.fromJoin.aliasOnLineAfterCursor) {
        prefix = ''
        return {
            range: cursorInsertRange(position),
            prefix,
        }
    }

    if (ctx.slot === 'on' || ctx.slot === 'where' || ctx.slot === 'having') {
        const clauseInput = clauseColumnInput(ctx.slot, lineBefore(model, position))
        if (clauseInput && clauseInput.partial === '') {
            return {range: cursorInsertRange(position), prefix: ''}
        }
    }

    return {range, prefix}
}
