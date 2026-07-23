/** Monaco CompletionItemKind 数值（避免在 Node 测试中加载 monaco-editor） */
export type CompletionDisplayCategory =
    | 'table'
    | 'column'
    | 'function'
    | 'keyword'
    | 'snippet'
    | 'alias'
    | 'fk'
    | 'expand'
    | 'ai'
    | 'recent'
    | 'value'
    | 'value_string'
    | 'value_number'
    | 'group_by'
    | 'order_by'
    | 'ordinal'

const COMPLETION_ITEM_KIND = {
    table: 5, // Class
    column: 3, // Field
    function: 1, // Function
    group_by: 3,
    order_by: 3,
    ordinal: 3,
    keyword: 17,
    snippet: 28,
    alias: 4, // Variable
    fk: 21, // Reference
    expand: 10, // Event
    ai: 10, // Event
    recent: 28, // Snippet
    value: 13, // Value
    value_string: 28, // Snippet — 字符串模板（Monaco Text/abc 在 showWords:false 时会被过滤）
    value_number: 12, // Unit — 数值模板，列表标签用 123
} as const satisfies Record<CompletionDisplayCategory, number>

/** 补全类别 → Monaco 内置图标（左侧小图标） */
export function completionItemKind(category: CompletionDisplayCategory): number {
    return COMPLETION_ITEM_KIND[category]
}

export type CompletionItemLabel = {
    label: string
    detail?: string
    description?: string
}

/** 右侧类型说明（如「表」「字段」「关键字」） */
export function categoryCompletionLabel(
    name: string,
    typeLabel: string,
    inlineDetail?: string,
): CompletionItemLabel {
    return {
        label: name,
        detail: inlineDetail,
        description: typeLabel,
    }
}

export function formatInlineScope(value?: string): string | undefined {
    if (!value?.trim()) return undefined
    return `(${value.trim()})`
}

/** 列补全：名称 + `(alias)` + 右侧列类型 */
export function columnCompletionLabel(
    name: string,
    meta: { type?: string; pk?: boolean },
    typeLabel: string,
    tableSource?: string,
): CompletionItemLabel {
    return {
        label: name,
        detail: formatInlineScope(tableSource),
        description: columnTypeBadge(meta, typeLabel),
    }
}

/** 函数补全：签名并入 label（避免 label.detail 被挤没）；返回类型走 label.description */
export function functionCompletionLabel(
    name: string,
    typeLabel: string,
    signature?: string,
    returns?: string,
): CompletionItemLabel {
    const displaySignature = signature?.trim()
        ? signature.trim().startsWith('(')
            ? signature.trim()
            : `(${signature.trim()})`
        : ''
    return {
        label: `${name}${displaySignature}`,
        description: returns?.trim() || typeLabel,
    }
}

/** 表补全：名称 + `(catalog)` + 右侧别名/关联说明 */
export function tableCompletionLabel(
    table: string,
    typeLabel: string,
    _aliasPreview?: string,
    catalog?: string,
    rightDetail?: string,
): CompletionItemLabel {
    return {
        label: table,
        detail: formatInlineScope(catalog),
        description: rightDetail?.trim() || typeLabel,
    }
}

/** 从 insertText 提取表名后的别名预览（如 `users u` → `u`） */
export function tableAliasPreview(insertText: string, table: string): string | undefined {
    if (!insertText || !insertText.startsWith(table)) return undefined
    const rest = insertText.slice(table.length).trim()
    return rest || undefined
}

/** 补全项：主标签 + 右侧说明 + 类型徽标 */
export function hintCompletionPresentation(
    name: string,
    hint: string,
    typeLabel: string,
    inlineDetail?: string,
): {
    label: CompletionItemLabel
    detail: string
    documentation?: { value: string; isTrusted: boolean }
} {
    const summary = hint.trim() || typeLabel
    const doc =
        summary !== typeLabel
            ? {value: summary, isTrusted: true}
            : undefined

    return {
        label: categoryCompletionLabel(name, typeLabel, inlineDetail),
        detail: summary,
        documentation: doc,
    }
}

/** 片段补全：主列表仅 trigger + 类型；说明与 SQL 在二级面板 */
export function snippetCompletionPresentation(
    name: string,
    hint: string,
    typeLabel: string,
    insertText: string,
): {
    label: CompletionItemLabel
    detail: string
    documentation: { value: string; isTrusted: boolean }
} {
    const summary = hint.trim() || typeLabel
    const fullSql = formatSnippetSqlPreview(insertText, 'full')
    const docBody = fullSql || summary

    return {
        label: categoryCompletionLabel(name, typeLabel),
        detail: summary,
        documentation: {value: docBody, isTrusted: true},
    }
}

import {formatSnippetSqlPreview, simplifySnippetInsertText} from './snippet-presentation'

/** 将 Monaco snippet 模板转为可读 SQL 预览 */
export {simplifySnippetInsertText} from './snippet-presentation'

export function columnTypeBadge(meta: { type?: string; pk?: boolean }, fallback: string): string {
    const parts: string[] = []
    if (meta.pk) parts.push('PK')
    if (meta.type) parts.push(meta.type)
    return parts.join(' · ') || fallback
}
