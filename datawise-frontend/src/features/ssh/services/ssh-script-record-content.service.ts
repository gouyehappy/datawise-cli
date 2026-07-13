import {htmlToPlainText} from '@/features/ssh/services/ssh-html-text.service'

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

/** 从已存 HTML 读取命令纯文本（兼容旧富文本记录） */
export function recordHtmlToCommandText(html: string): string {
    return htmlToPlainText(html)
}

/** 保存为 pre 块，避免富文本段落丢换行 */
export function commandTextToRecordHtml(text: string): string {
    const normalized = text.replace(/\r\n/g, '\n')
    if (!normalized.trim()) return ''
    return `<pre>${escapeHtml(normalized)}</pre>`
}

export const SSH_COMMAND_TEMPLATE = `@paste
# 标题
command here
`
