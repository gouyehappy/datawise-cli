import type {Ref} from 'vue'
import {
    createAssistantMessage,
    createUserMessage,
} from '@/features/ai/chat/services/ai-chat.service'
import {useAnalysisStream} from '@/features/ai/analysis/composables/useAnalysisStream'
import {buildAnalysisResult} from '@/features/ai/analysis/services/analysis-result.service'
import {isAnalysisPrompt} from '@/features/ai/analysis/utils/analysis-intent'
import {buildAnalysisContextFromMessages} from '@/features/ai/analysis/utils/analysis-context'
import {useAiChatStore} from '@/features/ai/stores/ai-chat'
import {formatAiErrorMessage} from '@/features/ai/shared/utils/ai-error'
import type {AiDatabaseTarget} from '@/features/ai/shared/utils/database-targets'
import type {AiAnalysisContextPayload} from '@/features/ai/types/analysis'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useToastStore} from '@/features/layout/stores/toast-store'
import {aiApi, logAiChatError} from '@/api'
import {t} from '@/i18n'

const REPLY_DELAY_MS = 500

function delay(ms: number) {
    return new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms)
    })
}

/** AI 聊天发送：普通对话 + 分析流式编排 */
export function useAiChatSend(options: {
    allTargets: Ref<AiDatabaseTarget[]>
    scrollToBottom: () => Promise<void>
    clearInput: () => void
    restoreInput: (value: string) => void
    getInput: () => string
    getAttachments?: () => Array<{ id: string; name: string; file: File }>
    buildPrompt?: (prompt: string) => Promise<string>
}) {
    const toast = useToastStore()
    const aiChat = useAiChatStore()
    const appConfig = useAppConfigStore()

    const pipeline = useAnalysisStream({scrollToBottom: options.scrollToBottom})

    async function sendChat(
        text: string,
        targets: AiDatabaseTarget[],
        sessionId: string,
        analysisContext?: AiAnalysisContextPayload,
    ) {
        await delay(REPLY_DELAY_MS)
        const result = await aiApi.generateReply(text, {
            targets,
            aiPreferences: appConfig.aiPreferences,
            analysisContext,
        })

        const analysis = buildAnalysisResult(result)
        const replyText = result.reply?.trim() || (analysis ? t('ai.analysis.done') : '')
        aiChat.appendMessage(createAssistantMessage(replyText, {analysis}), sessionId)
    }

    async function send(textOverride?: string) {
        const session = aiChat.activeSession
        const rawText = (textOverride ?? options.getInput()).trim()
        if (!session || !rawText || aiChat.isSending(session.id) || pipeline.sqlConfirmPending.value) return

        let text = rawText
        if (!textOverride && options.buildPrompt) {
            text = (await options.buildPrompt(rawText)).trim()
            if (!text) return
        }

        const sessionId = session.id
        const targets = options.allTargets.value.filter((target) =>
            session.selectedTargetIds.includes(target.id),
        )

        const databases = targets.map((target) => ({
            id: target.id,
            connectionLabel: target.connectionLabel,
            databaseLabel: target.databaseLabel,
            tableLabel: target.tableLabel,
            level: target.level,
            dbType: target.dbType,
        }))

        const priorContext = buildAnalysisContextFromMessages(session.messages)
        const useStream = isAnalysisPrompt(text, targets.length > 0, priorContext)

        aiChat.appendMessage(createUserMessage(text, databases.length ? databases : undefined), sessionId)
        options.clearInput()
        pipeline.resetPipeline()
        pipeline.analysisStreaming.value = useStream
        aiChat.setSending(sessionId, true)
        await options.scrollToBottom()

        try {
            if (useStream) {
                await pipeline.streamAnalysis(text, targets, sessionId, priorContext)
            } else {
                await sendChat(text, targets, sessionId, priorContext)
            }
        } catch (error) {
            logAiChatError(error, 0)
            toast.show(formatAiErrorMessage(error))
            options.restoreInput(text)
        } finally {
            pipeline.finishStreaming(sessionId)
            if (aiChat.activeSessionId === sessionId) await options.scrollToBottom()
        }
    }

    return {
        send,
        ...pipeline,
    }
}

export type {AiSqlConfirmPending} from '@/features/ai/types/chat'
