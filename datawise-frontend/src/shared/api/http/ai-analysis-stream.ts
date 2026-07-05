import type {
    AiAnalysisContextPayload,
    AiAnalysisInterruptPayload,
    AiAnalysisResumeRequest,
    AiAnalysisStepEvent,
    AiChatReplyPayload,
} from '@/features/ai/types/analysis'
import {readApiBaseUrl} from '@/shared/api/mode'
import {resolveApiErrorMessage} from '@/shared/api/http/api-error-message'
import {ApiError} from '@/shared/api/http/request'
import type {AiAnalysisErrorPayload} from '@/features/ai/shared/utils/ai-error'
import {consumeAnalysisSseStream} from '@/features/ai/analysis/services/analysis-stream-consumer.service'

export interface AiAnalysisStreamRequest {
    prompt: string
    targets: unknown[]
    llm: unknown
    stepLlms?: Record<string, unknown>
    analysisContext?: AiAnalysisContextPayload
    skipSqlConfirmation?: boolean
    analysisMode?: 'quick' | 'smart' | 'custom'
    disabledAnalysisSteps?: string[]
}

export interface AiAnalysisStreamHandlers {
    onStep: (step: AiAnalysisStepEvent) => void
    onResult: (result: AiChatReplyPayload) => void
    onInterrupt?: (payload: AiAnalysisInterruptPayload) => void
    onError?: (payload: AiAnalysisErrorPayload) => void
}

function buildUrl(path: string): string {
    const baseUrl = readApiBaseUrl()
    return baseUrl ? `${baseUrl}${path}` : path
}

function sessionHeaders(): Record<string, string> {
    if (typeof localStorage === 'undefined') return {}
    const sessionId = localStorage.getItem('dw-cli-session-id')
    return sessionId ? {'X-DW-Session-Id': sessionId} : {}
}

async function postAnalysisSse(path: string, body: unknown): Promise<Response> {
    let response: Response
    try {
        response = await fetch(buildUrl(path), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
                ...sessionHeaders(),
            },
            body: JSON.stringify(body),
            credentials: 'include',
        })
    } catch {
        throw new ApiError('HTTP API request failed. Ensure the backend is running.')
    }

    if (!response.ok || !response.body) {
        throw new ApiError(`HTTP ${response.status}`)
    }
    return response
}

/** POST SSE：数据分析流水线步骤 + 最终结果 / interrupt */
export async function streamAiAnalysis(
    path: string,
    body: AiAnalysisStreamRequest,
    handlers: AiAnalysisStreamHandlers,
): Promise<void> {
    const response = await postAnalysisSse(path, body)
    await consumeAnalysisSseStream(response.body!, handlers)
}

/** POST SSE：确认/取消后恢复分析流水线 */
export async function resumeAiAnalysis(
    path: string,
    body: AiAnalysisResumeRequest,
    handlers: AiAnalysisStreamHandlers,
): Promise<void> {
    const response = await postAnalysisSse(path, body)
    await consumeAnalysisSseStream(response.body!, handlers)
}

export function toAnalysisStreamError(error: unknown): string {
    if (error instanceof ApiError) return error.message
    return resolveApiErrorMessage(error)
}
