import type {SqlFunctionSignature} from './function-config'

/** 函数补全仅用名称过滤，避免 Monaco 模糊匹配到无关项 */
export function functionFilterText(name: string): string {
    return name
}

function stripOuterParens(value: string): string {
    let s = value.trim()
    while (s.startsWith('(') && s.endsWith(')')) {
        s = s.slice(1, -1).trim()
    }
    return s
}

/** 将配置签名转为 snippet 占位文本（如 [DISTINCT] expr → DISTINCT expr） */
export function signaturePlaceholderText(signature?: string): string | undefined {
    if (!signature?.trim()) return undefined
    const inner = stripOuterParens(signature.trim())
    if (!inner) return undefined
    return inner.replace(/^\[DISTINCT\]\s*/i, 'DISTINCT ').trim()
}

/** 列表展示用签名，保留可选参数方括号 */
export function formatFunctionDisplaySignature(signature?: string): string | undefined {
    if (!signature?.trim()) return undefined
    const trimmed = signature.trim()
    return trimmed.startsWith('(') ? trimmed : `(${trimmed})`
}

/** 生成 Monaco snippet：SUM(${1:DISTINCT expr})；配置 insert 列可覆盖 */
export function buildFunctionInsertSnippet(fn: SqlFunctionSignature): string {
    if (fn.insertText?.trim()) return fn.insertText.trim()
    const placeholder = signaturePlaceholderText(fn.signature)
    if (!placeholder) return `${fn.name}($0)`
    return `${fn.name}(\${1:${placeholder}})`
}
