import {htmlToPlainText} from '@/features/ssh/services/ssh-html-text.service'

/** Detect legacy rich-text / pre-wrapped HTML records. */
export function looksLikeStoredHtml(value: string): boolean {
    const trimmed = value?.trim() ?? ''
    if (!trimmed) return false
    return /^<[a-z!/?]/i.test(trimmed) || /<\/(?:p|div|pre|span|br|li|h[1-6]|ul|ol)\s*>/i.test(trimmed)
}

/** Normalize any stored payload (plain or legacy HTML) to editable command text. */
export function toPlainCommandText(stored: string): string {
    if (!stored) return ''
    if (looksLikeStoredHtml(stored)) {
        return htmlToPlainText(stored)
    }
    return stored.replace(/\r\n/g, '\n')
}

/** Persist command text as plain text (no HTML wrapper). */
export function toStoredCommandText(text: string): string {
    return (text ?? '').replace(/\r\n/g, '\n')
}

/** @deprecated Use {@link toPlainCommandText} */
export function recordHtmlToCommandText(html: string): string {
    return toPlainCommandText(html)
}

/** @deprecated Use {@link toStoredCommandText} — kept for call-site compatibility. */
export function commandTextToRecordHtml(text: string): string {
    return toStoredCommandText(text)
}

export const SSH_COMMAND_TEMPLATE = `@paste
# 标题
command here
`

export const SSH_COMMAND_COMPLETIONS = [
    {label: '@run', insertText: '@run\n', detail: 'Run each command in the terminal'},
    {label: '@paste', insertText: '@paste\n', detail: 'Paste commands without executing'},
    {label: '# title', insertText: '# ${1:标题}\n', detail: 'Command label for quick ops'},
    {label: '!run', insertText: '!run', detail: 'Override this entry to run'},
    {label: '!paste', insertText: '!paste', detail: 'Override this entry to paste'},
    {label: '{{appId}}', insertText: '{{appId}}', detail: 'YARN application id parameter'},
    {label: '{{topic}}', insertText: '{{topic}}', detail: 'Kafka topic parameter'},
] as const
