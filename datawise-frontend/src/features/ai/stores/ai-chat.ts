import {defineStore} from 'pinia'
import {computed, ref, watch} from 'vue'
import {
    buildSessionTitle,
    createWelcomeMessages,
} from '@/features/ai/chat/services/ai-chat.service'
import {
    buildAiChatPersistenceState,
    readAiChatState,
    writeAiChatState,
} from '@/features/ai/chat/services/ai-chat-persistence.service'
import type {AiChatMessage} from '@/features/ai/types'
import type {AiChatSession} from '@/features/ai/types/session'
import {createId} from '@/core/utils/id'
import {t} from '@/i18n'

export type {AiChatSession} from '@/features/ai/types/session'

const PERSIST_DEBOUNCE_MS = 320

export const useAiChatStore = defineStore('ai-chat', () => {
    const persisted = readAiChatState()
    const sessions = ref<AiChatSession[]>(persisted?.sessions ?? [])
    const activeSessionId = ref<string | null>(persisted?.activeSessionId ?? null)
    const sendingSessionIds = ref<string[]>([])
    let persistTimer: ReturnType<typeof setTimeout> | null = null

    const activeSession = computed(() =>
        sessions.value.find((session) => session.id === activeSessionId.value) ?? null,
    )

    const sortedSessions = computed(() =>
        [...sessions.value].sort((a, b) => b.updatedAt - a.updatedAt),
    )

    function schedulePersist() {
        if (persistTimer) clearTimeout(persistTimer)
        persistTimer = setTimeout(() => {
            persistTimer = null
            const state = buildAiChatPersistenceState(sessions.value, activeSessionId.value)
            writeAiChatState(state)
        }, PERSIST_DEBOUNCE_MS)
    }

    watch([sessions, activeSessionId], () => schedulePersist(), {deep: true})

    function touchSession(session: AiChatSession) {
        session.updatedAt = Date.now()
    }

    function createSession(selectedTargetIds: string[] = []): AiChatSession {
        const now = Date.now()
        const session: AiChatSession = {
            id: createId('chat'),
            title: t('ai.history.newChat'),
            createdAt: now,
            updatedAt: now,
            messages: createWelcomeMessages(t('ai.welcome')),
            selectedTargetIds: [...new Set(selectedTargetIds)],
        }
        sessions.value.unshift(session)
        activeSessionId.value = session.id
        return session
    }

    function ensureInitialized(selectedTargetIds: string[] = []) {
        if (sessions.value.length) {
            if (!activeSessionId.value || !sessions.value.some((item) => item.id === activeSessionId.value)) {
                activeSessionId.value = sessions.value[0].id
            }
            return activeSession.value
        }
        return createSession(selectedTargetIds)
    }

    function selectSession(id: string) {
        if (!sessions.value.some((session) => session.id === id)) return
        activeSessionId.value = id
    }

    function deleteSession(id: string) {
        const index = sessions.value.findIndex((session) => session.id === id)
        if (index < 0) return

        sessions.value.splice(index, 1)
        sendingSessionIds.value = sendingSessionIds.value.filter((sessionId) => sessionId !== id)

        if (!sessions.value.length) {
            createSession()
            return
        }

        if (activeSessionId.value === id) {
            activeSessionId.value = sessions.value[0].id
        }
    }

    function setSelectedTargetIds(ids: string[]) {
        const session = activeSession.value
        if (!session) return
        session.selectedTargetIds = [...new Set(ids)]
        touchSession(session)
    }

    function appendMessage(message: AiChatMessage, sessionId = activeSessionId.value) {
        const session = sessions.value.find((item) => item.id === sessionId)
        if (!session) return
        session.messages.push(message)

        if (message.role === 'user' && session.title === t('ai.history.newChat')) {
            session.title = buildSessionTitle(message.content, t('ai.history.newChat'))
        }

        touchSession(session)
    }

    function isSending(sessionId = activeSessionId.value): boolean {
        return sessionId ? sendingSessionIds.value.includes(sessionId) : false
    }

    function setSending(sessionId: string, sending: boolean) {
        if (sending) {
            if (!sendingSessionIds.value.includes(sessionId)) {
                sendingSessionIds.value = [...sendingSessionIds.value, sessionId]
            }
            return
        }
        sendingSessionIds.value = sendingSessionIds.value.filter((id) => id !== sessionId)
    }

    function reloadForCurrentScope() {
        if (persistTimer) {
            clearTimeout(persistTimer)
            persistTimer = null
        }
        const next = readAiChatState()
        sessions.value = next?.sessions ?? []
        activeSessionId.value = next?.activeSessionId ?? null
        sendingSessionIds.value = []
        if (!sessions.value.length) {
            ensureInitialized()
        }
    }

    return {
        sessions,
        activeSessionId,
        activeSession,
        sortedSessions,
        ensureInitialized,
        createSession,
        selectSession,
        deleteSession,
        setSelectedTargetIds,
        appendMessage,
        isSending,
        setSending,
        reloadForCurrentScope,
    }
})
