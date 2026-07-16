import {ref, type Ref} from 'vue'
import {createAssistantMessage} from '@/features/ai/chat/services/ai-chat.service'
import {buildAnalysisResult} from '@/features/ai/analysis/services/analysis-result.service'
import {
    reconcileTerminalAnalysisSteps,
    stripDisabledAnalysisArtifacts,
} from '@/features/ai/analysis/services/analysis-step.service'
import {useAiChatStore} from '@/features/ai/stores/ai-chat'
import type {AiSqlConfirmPending} from '@/features/ai/types/chat'
import type {
    AiAnalysisContextPayload,
    AiAnalysisInterruptPayload,
    AiAnalysisStepEvent,
    AiChatReplyPayload,
} from '@/features/ai/types/analysis'
import type {AiDatabaseTarget} from '@/features/ai/shared/utils/database-targets'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useAppToast} from '@/features/layout/composables/useAppToast'
import {formatAiAnalysisStreamError, formatAiErrorMessage} from '@/features/ai/shared/utils/ai-error'
import type {AiAnalysisErrorPayload} from '@/features/ai/shared/utils/ai-error'
import {t} from '@/i18n'
import {API_PATHS} from '@/api'
import {buildAnalysisStepLlms} from '@/features/ai/shared/services/ai-llm-routing.service'
import {
    logAiChatError,
    logAiChatRequest,
    logAiChatResponse,
    resolveWorkbenchAiLlmProfile,
    resumeAiAnalysis,
    streamAiAnalysis,
    toAiDatabaseTargetPayload,
    toAiLlmProfilePayload,
} from '@/api'

interface UseAnalysisStreamOptions {
    scrollToBottom: () => Promise<void>
}

export function useAnalysisStream(options: UseAnalysisStreamOptions) {
    const toast = useAppToast()
    const aiChat = useAiChatStore()
    const appConfig = useAppConfigStore()

    const analysisSteps = ref<AiAnalysisStepEvent[]>([])
    const analysisStreaming = ref(false)
    const sqlConfirmPending = ref<AiSqlConfirmPending | null>(null)
    const resumingSql = ref(false)

    function resetPipeline() {
        analysisSteps.value = []
        sqlConfirmPending.value = null
    }

    function upsertAnalysisStep(step: AiAnalysisStepEvent) {
        const index = analysisSteps.value.findIndex((item) => item.step === step.step)
        if (index >= 0) {
            analysisSteps.value[index] = step
            analysisSteps.value = [...analysisSteps.value]
            return
        }
        analysisSteps.value = [...analysisSteps.value, step]
    }

    function appendAnalysisReply(
        result: AiChatReplyPayload,
        sessionId: string,
        started: number,
    ) {
        const steps = analysisSteps.value
        const sanitizedResult = stripDisabledAnalysisArtifacts(result, steps)
        const analysis = buildAnalysisResult(sanitizedResult)
        const replyText = sanitizedResult.reply?.trim() || (analysis ? t('ai.analysis.done') : '')
        logAiChatResponse(
            {
                reply: replyText,
                mode: 'analysis',
                sql: sanitizedResult.sql,
                columns: sanitizedResult.columns,
                rows: sanitizedResult.rows,
                chart: sanitizedResult.chart,
            },
            Math.round(performance.now() - started),
        )
        aiChat.appendMessage(
            createAssistantMessage(replyText, {
                analysis,
                analysisSteps: steps.length ? [...steps] : undefined,
            }),
            sessionId,
        )
    }

    function appendFailureReply(text: string, sessionId: string) {
        const steps = analysisSteps.value
        const replyText = text.trim() || t('ai.generateFailedGeneric')
        aiChat.appendMessage(
            createAssistantMessage(replyText, {
                analysisSteps: steps.length ? [...steps] : undefined,
            }),
            sessionId,
        )
    }

    function buildStreamHandlers(sessionId: string, started: number) {
        return {
            onStep: (step: AiAnalysisStepEvent) => {
                upsertAnalysisStep(step)
                if (step.step === 'sql_execute' && step.status === 'failed') {
                    sqlConfirmPending.value = null
                }
                void options.scrollToBottom()
            },
            onInterrupt: (payload: AiAnalysisInterruptPayload) => {
                sqlConfirmPending.value = {
                    sessionId,
                    threadId: payload.threadId,
                    checkpointId: payload.checkpointId,
                    sql: payload.sql,
                }
            },
            onResult: (result: AiChatReplyPayload) => {
                analysisSteps.value = reconcileTerminalAnalysisSteps(analysisSteps.value, result)
                if (result.mode === 'chat' && result.reply?.includes('数据分析失败')) {
                    appendFailureReply(result.reply, sessionId)
                    return
                }
                appendAnalysisReply(result, sessionId, started)
            },
            onError: (payload: AiAnalysisErrorPayload) => {
                appendFailureReply(formatAiAnalysisStreamError(payload), sessionId)
            },
        }
    }

    async function streamAnalysis(
        text: string,
        targets: AiDatabaseTarget[],
        sessionId: string,
        analysisContext?: AiAnalysisContextPayload,
    ) {
        const profile = resolveWorkbenchAiLlmProfile(appConfig.aiPreferences)
        logAiChatRequest(text, targets.length)
        const started = performance.now()

        await streamAiAnalysis(
            API_PATHS.ai.analyzeStream,
            {
                prompt: text,
                targets: targets.map(toAiDatabaseTargetPayload),
                llm: toAiLlmProfilePayload(profile),
                stepLlms: buildAnalysisStepLlms(appConfig.aiPreferences),
                analysisContext,
                skipSqlConfirmation: appConfig.aiPreferences.skipSqlConfirmation === true,
                analysisMode: appConfig.aiPreferences.analysisMode ?? 'smart',
                disabledAnalysisSteps:
                    (appConfig.aiPreferences.analysisMode ?? 'smart') === 'custom'
                        ? (appConfig.aiPreferences.disabledAnalysisSteps ?? [])
                        : [],
            },
            buildStreamHandlers(sessionId, started),
        )
    }

    async function resumeSqlConfirmation(approved: boolean) {
        const pending = sqlConfirmPending.value
        if (!pending || resumingSql.value) return

        const sessionId = pending.sessionId
        resumingSql.value = true
        analysisStreaming.value = true
        aiChat.setSending(sessionId, true)
        const started = performance.now()

        try {
            await resumeAiAnalysis(
                API_PATHS.ai.analyzeResume,
                {
                    threadId: pending.threadId,
                    checkpointId: pending.checkpointId,
                    approved,
                },
                buildStreamHandlers(sessionId, started),
            )
        } catch (error) {
            logAiChatError(error, 0)
            appendFailureReply(formatAiErrorMessage(error), sessionId)
            toast.error(formatAiErrorMessage(error))
        } finally {
            sqlConfirmPending.value = null
            analysisSteps.value = []
            analysisStreaming.value = false
            resumingSql.value = false
            aiChat.setSending(sessionId, false)
            if (aiChat.activeSessionId === sessionId) await options.scrollToBottom()
        }
    }

    function finishStreaming(sessionId: string) {
        if (!sqlConfirmPending.value) {
            analysisSteps.value = []
            analysisStreaming.value = false
            aiChat.setSending(sessionId, false)
        } else {
            analysisStreaming.value = false
            aiChat.setSending(sessionId, false)
        }
    }

    return {
        analysisSteps,
        analysisStreaming,
        sqlConfirmPending,
        resumingSql,
        resetPipeline,
        streamAnalysis,
        finishStreaming,
        confirmSqlExecution: () => resumeSqlConfirmation(true),
        cancelSqlExecution: () => resumeSqlConfirmation(false),
    }
}
