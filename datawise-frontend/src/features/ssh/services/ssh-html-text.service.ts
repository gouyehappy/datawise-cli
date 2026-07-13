/** 将脚本记录 HTML 转为可发送到终端的纯文本（保留段落换行） */
export function htmlToPlainText(html: string): string {
    if (!html.trim()) return ''
    const htmlWithBreaks = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|pre|li|h[1-6]|tr)>/gi, '\n')
        .replace(/<\/(td|th)>/gi, '\t')
    if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(htmlWithBreaks, 'text/html')
        return normalizePlainText(doc.body.textContent ?? '')
    }
    return normalizePlainText(htmlWithBreaks.replace(/<[^>]+>/g, ''))
}

function normalizePlainText(value: string): string {
    return value
        .replace(/\r\n/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}
