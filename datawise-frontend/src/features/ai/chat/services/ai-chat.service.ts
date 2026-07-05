import type {AiChatMessage} from '@/features/ai/types'
import {i18n} from '@/i18n'

export type {AiChatMessage, MessageBlock} from '@/features/ai/types'

/** 将助手回复拆成文本、列表与代码块，便于渲染 */
export function parseMessageBlocks(content: string) {
    const blocks: import('@/features/ai/types').MessageBlock[] = []
    const parts = content.split(/(```[\s\S]*?```)/g)

    for (const part of parts) {
        if (!part) continue

        if (part.startsWith('```') && part.endsWith('```')) {
            blocks.push({type: 'code', code: part.replace(/```/g, '').trim()})
            continue
        }

        const lines = part.split('\n')
        let textBuffer: string[] = []
        let listBuffer: string[] = []

        const flushText = () => {
            const text = textBuffer.join('\n').trim()
            if (text) blocks.push({type: 'text', text})
            textBuffer = []
        }

        const flushList = () => {
            if (listBuffer.length) blocks.push({type: 'list', items: [...listBuffer]})
            listBuffer = []
        }

        for (const line of lines) {
            const listMatch = line.match(/^\s*[-•]\s+(.*)$/)
            if (listMatch) {
                flushText()
                listBuffer.push(listMatch[1])
                continue
            }

            if (listBuffer.length) flushList()
            textBuffer.push(line)
        }

        flushList()
        flushText()
    }

    if (!blocks.length) blocks.push({type: 'text', text: content})
    return blocks
}

function nowTime() {
    return new Date().toLocaleTimeString(i18n.global.locale.value, {hour12: false})
}

export function createUserMessage(
    content: string,
    databases?: AiChatMessage['databases'],
): AiChatMessage {
    return {id: `u-${Date.now()}`, role: 'user', content, time: nowTime(), databases}
}

export function createAssistantMessage(
    content: string,
    options?: {
        kind?: AiChatMessage['kind']
        analysis?: AiChatMessage['analysis']
        analysisSteps?: AiChatMessage['analysisSteps']
    },
): AiChatMessage {
    return {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content,
        time: nowTime(),
        kind: options?.kind,
        analysis: options?.analysis,
        analysisSteps: options?.analysisSteps?.length ? [...options.analysisSteps] : undefined,
    }
}

export function createWelcomeMessages(welcomeText: string): AiChatMessage[] {
    return [createAssistantMessage(welcomeText, {kind: 'welcome'})]
}

export function buildSessionTitle(text: string, fallback: string): string {
    const trimmed = text.trim().replace(/\s+/g, ' ')
    if (!trimmed) return fallback
    return trimmed.length > 30 ? `${trimmed.slice(0, 30)}…` : trimmed
}

/** 从助手回复中提取 SQL 片段；若已是可执行 SQL 则直接返回 */
export function extractSqlFromContent(content: string): string | null {
    const trimmed = content.trim()
    if (/^(?:--|SELECT|WITH)\b/i.test(trimmed)) {
        return trimmed
    }
    const match = trimmed.match(/```[\s\S]*?```|SELECT[\s\S]+?;/i)
    if (!match) return null
    return match[0].replace(/```/g, '').trim()
}
