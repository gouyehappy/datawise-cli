export type ExecutableSqlResolution = {
    sql: string
    /** 选区或光标语句在编辑器中的起始行（1-based），用于错误行映射 */
    anchorLine?: number | null
}

/** 控制台执行 SQL：显式 string → 编辑器选区 → 光标所在完整语句（多行向上下扩展）→ 可选全文 */
export function resolveExecutableSql(
    executableOverride: unknown,
    getSelectedText: () => string,
    options?: {
        fallbackToCurrentLineSql?: () => string
        getCurrentLineNumber?: () => number | null
        fallbackToFullDocument?: () => string
        getSelectionStartLine?: () => number | null
    },
): ExecutableSqlResolution {
    if (typeof executableOverride === 'string') {
        const trimmed = executableOverride.trim()
        if (trimmed) return {sql: trimmed}
    }
    const selected = getSelectedText().trim()
    if (selected) {
        return {
            sql: selected,
            anchorLine: options?.getSelectionStartLine?.() ?? null,
        }
    }
    const onCurrentLine = options?.fallbackToCurrentLineSql?.().trim()
    if (onCurrentLine) {
        return {
            sql: onCurrentLine,
            anchorLine: options?.getCurrentLineNumber?.() ?? null,
        }
    }
    if (options?.fallbackToFullDocument) {
        return {sql: options.fallbackToFullDocument().trim()}
    }
    return {sql: ''}
}
