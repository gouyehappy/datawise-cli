export interface AnalysisReportSection {
    title: string
    html: string
}

export interface ParsedAnalysisReport {
    title: string
    sections: AnalysisReportSection[]
    excerpt: string
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function plainExcerpt(markdown: string, maxLen = 140): string {
    const text = markdown
        .replace(/^#+\s+/gm, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\|/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (!text) return ''
    return text.length <= maxLen ? text : `${text.slice(0, maxLen).trim()}…`
}

function renderInlineMarkdown(text: string): string {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function renderTableBlock(lines: string[]): string {
    if (lines.length < 2) return ''
    const parseRow = (line: string) =>
        line
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim())

    const headers = parseRow(lines[0])
    const bodyLines = lines.slice(2)
    const headHtml = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
    const bodyHtml = bodyLines
        .map((line) => {
            const cells = parseRow(line)
            return `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
        })
        .join('')
    return `<div class="report-table-wrap"><table class="report-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`
}

function renderSectionBody(body: string): string {
    const lines = body.replace(/\r\n/g, '\n').split('\n')
    const parts: string[] = []
    let index = 0

    while (index < lines.length) {
        const line = lines[index]

        if (line.startsWith('```')) {
            const lang = line.slice(3).trim()
            const codeLines: string[] = []
            index += 1
            while (index < lines.length && !lines[index].startsWith('```')) {
                codeLines.push(lines[index])
                index += 1
            }
            if (index < lines.length) index += 1
            const label = lang ? `<span class="report-code__lang">${escapeHtml(lang)}</span>` : ''
            parts.push(
                `<div class="report-code">${label}<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre></div>`,
            )
            continue
        }

        if (line.trim().startsWith('|') && index + 1 < lines.length && lines[index + 1].includes('---')) {
            const tableLines: string[] = [line, lines[index + 1]]
            index += 2
            while (index < lines.length && lines[index].trim().startsWith('|')) {
                tableLines.push(lines[index])
                index += 1
            }
            parts.push(renderTableBlock(tableLines))
            continue
        }

        if (/^[-*]\s+/.test(line.trim())) {
            const items: string[] = []
            while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
                items.push(lines[index].trim().replace(/^[-*]\s+/, ''))
                index += 1
            }
            parts.push(
                `<ul class="report-list">${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`,
            )
            continue
        }

        if (!line.trim()) {
            index += 1
            continue
        }

        const paragraphLines: string[] = []
        while (
            index < lines.length &&
            lines[index].trim() &&
            !lines[index].startsWith('```') &&
            !lines[index].trim().startsWith('|') &&
            !/^[-*]\s+/.test(lines[index].trim())
            ) {
            paragraphLines.push(lines[index].trim())
            index += 1
        }
        parts.push(`<p class="report-paragraph">${renderInlineMarkdown(paragraphLines.join(' '))}</p>`)
    }

    return parts.join('')
}

export function parseAnalysisReport(markdown: string): ParsedAnalysisReport {
    const normalized = markdown.replace(/\r\n/g, '\n').trim()
    if (!normalized) {
        return {title: '', sections: [], excerpt: ''}
    }

    const lines = normalized.split('\n')
    let title = ''
    let startIndex = 0
    if (lines[0]?.startsWith('# ')) {
        title = lines[0].slice(2).trim()
        startIndex = 1
    }

    const sections: AnalysisReportSection[] = []
    let currentTitle = ''
    let currentBody: string[] = []

    const flush = () => {
        const body = currentBody.join('\n').trim()
        if (!currentTitle && !body) return
        sections.push({
            title: currentTitle || title || 'Report',
            html: renderSectionBody(body),
        })
        currentTitle = ''
        currentBody = []
    }

    for (let i = startIndex; i < lines.length; i += 1) {
        const line = lines[i]
        if (line.startsWith('## ')) {
            flush()
            currentTitle = line.slice(3).trim()
            continue
        }
        currentBody.push(line)
    }
    flush()

    const summarySection = sections.find((s) => /^summary$/i.test(s.title))
    const excerpt = summarySection
        ? plainExcerpt(summarySection.html.replace(/<[^>]+>/g, ' '))
        : plainExcerpt(normalized)

    return {title: title || 'Analysis Report', sections, excerpt}
}
