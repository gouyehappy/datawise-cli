import {t} from '@/i18n'

export interface AiAnalysisErrorPayload {
    code?: string
    message?: string
}

/** 将 AI / LLM 调用异常转为可展示的 Toast 文案 */
export function formatAiErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
        return t('ai.generateFailed', {detail: error.message.trim()})
    }
    return t('ai.generateFailedGeneric')
}

/** 将 SSE analysis error 事件映射为可读文案（优先稳定 error code） */
export function formatAiAnalysisStreamError(payload: AiAnalysisErrorPayload): string {
    const code = payload.code?.trim()
    if (code) {
        const key = `ai.errors.${code}`
        const translated = t(key)
        if (translated !== key) {
            return translated
        }
    }
    const message = payload.message?.trim()
    if (message) {
        return message
    }
    return t('ai.generateFailedGeneric')
}
