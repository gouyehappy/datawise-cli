import type {
    AiAnalysisInterruptPayload,
    AiAnalysisStepEvent,
    AiChatReplyPayload,
} from '@/features/ai/types/analysis'
import type {AiAnalysisErrorPayload} from '@/features/ai/shared/utils/ai-error'
import {parseSseBlock} from '@/features/ai/analysis/services/analysis-stream-parser.service'

export interface AnalysisStreamHandlers {
    onStep: (step: AiAnalysisStepEvent) => void
    onResult: (result: AiChatReplyPayload) => void
    onInterrupt?: (payload: AiAnalysisInterruptPayload) => void
    onError?: (payload: AiAnalysisErrorPayload) => void
}

/** 消费 ReadableStream SSE 体（step / interrupt / result / error） */
export async function consumeAnalysisSseStream(
    body: ReadableStream<Uint8Array>,
    handlers: AnalysisStreamHandlers,
): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const {done, value} = await reader.read()
        if (done) break

        buffer += decoder.decode(value, {stream: true})
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? ''

        for (const block of blocks) {
            dispatchSseBlock(block, handlers)
        }
    }

    if (buffer.trim()) {
        dispatchSseBlock(buffer, handlers)
    }
}

function dispatchSseBlock(block: string, handlers: AnalysisStreamHandlers): void {
    const parsed = parseSseBlock(block.trim())
    if (!parsed) return

    if (parsed.event === 'step') {
        handlers.onStep(JSON.parse(parsed.data) as AiAnalysisStepEvent)
        return
    }
    if (parsed.event === 'interrupt') {
        handlers.onInterrupt?.(JSON.parse(parsed.data) as AiAnalysisInterruptPayload)
        return
    }
    if (parsed.event === 'result') {
        handlers.onResult(JSON.parse(parsed.data) as AiChatReplyPayload)
        return
    }
    if (parsed.event === 'error') {
        handlers.onError?.(JSON.parse(parsed.data) as AiAnalysisErrorPayload)
    }
}

/** 测试用：将 SSE 文本编码为 ReadableStream */
export function encodeSseText(text: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    return new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(text))
            controller.close()
        },
    })
}
