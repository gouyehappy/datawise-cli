import type {AiChatMessage} from '@/features/ai/types/messages'
import type {AiChatSession} from '@/features/ai/types/session'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {
    canPersistLocalResource,
    canReadResource,
    resolveResourceStorageKey,
} from '@/features/auth/services/user-resource-policy'

export const AI_CHAT_STORAGE_KEY = 'dw-cli-ai-chat'
export const AI_CHAT_STATE_VERSION = 1 as const
export const AI_CHAT_MAX_SESSIONS = 60
const FALLBACK_SESSION_TITLE = '新对话'

function createPersistedWelcomeFallback(): AiChatMessage[] {
    return [{id: 'welcome', role: 'assistant', content: '', time: '', kind: 'welcome'}]
}

export interface AiChatPersistenceState {
    version: typeof AI_CHAT_STATE_VERSION
    activeSessionId: string | null
    sessions: AiChatSession[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeMessage(raw: unknown): AiChatMessage | null {
    if (!isRecord(raw)) return null
    const role = raw.role
    if (role !== 'user' && role !== 'assistant') return null
    const content = typeof raw.content === 'string' ? raw.content : ''
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : `m-${Date.now()}`
    const time = typeof raw.time === 'string' ? raw.time : ''
    const message: AiChatMessage = {id, role, content, time}
    if (raw.kind === 'welcome') message.kind = 'welcome'
    if (isRecord(raw.analysis) || raw.analysis) {
        message.analysis = raw.analysis as AiChatMessage['analysis']
    }
    if (Array.isArray(raw.analysisSteps)) {
        message.analysisSteps = raw.analysisSteps as AiChatMessage['analysisSteps']
    }
    if (Array.isArray(raw.databases)) {
        message.databases = raw.databases as AiChatMessage['databases']
    }
    return message
}

function normalizeSession(raw: unknown): AiChatSession | null {
    if (!isRecord(raw)) return null
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : null
    if (!id) return null
    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title : FALLBACK_SESSION_TITLE
    const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now()
    const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : createdAt
    const messages = Array.isArray(raw.messages)
        ? raw.messages.map(normalizeMessage).filter((item): item is AiChatMessage => item !== null)
        : []
    const selectedTargetIds = Array.isArray(raw.selectedTargetIds)
        ? [...new Set(raw.selectedTargetIds.filter((item): item is string => typeof item === 'string'))]
        : []
    return {
        id,
        title,
        createdAt,
        updatedAt,
        messages: messages.length ? messages : createPersistedWelcomeFallback(),
        selectedTargetIds,
    }
}

export function normalizeAiChatState(raw: unknown): AiChatPersistenceState | null {
    if (!isRecord(raw)) return null
    const sessions = Array.isArray(raw.sessions)
        ? raw.sessions.map(normalizeSession).filter((item): item is AiChatSession => item !== null)
        : []
    if (!sessions.length) return null

    const trimmed = trimSessions(sessions)
    let activeSessionId =
        typeof raw.activeSessionId === 'string' && trimmed.some((item) => item.id === raw.activeSessionId)
            ? raw.activeSessionId
            : trimmed[0]?.id ?? null

    return {
        version: AI_CHAT_STATE_VERSION,
        activeSessionId,
        sessions: trimmed,
    }
}

export function trimSessions(sessions: AiChatSession[]): AiChatSession[] {
    const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
    return sorted.slice(0, AI_CHAT_MAX_SESSIONS)
}

export function buildAiChatPersistenceState(
    sessions: AiChatSession[],
    activeSessionId: string | null,
): AiChatPersistenceState {
    const trimmed = trimSessions(sessions)
    const resolvedActive =
        activeSessionId && trimmed.some((item) => item.id === activeSessionId)
            ? activeSessionId
            : trimmed[0]?.id ?? null
    return {
        version: AI_CHAT_STATE_VERSION,
        activeSessionId: resolvedActive,
        sessions: trimmed,
    }
}

function resolveAiChatStorageKey(): string {
    return resolveResourceStorageKey(UserResource.AiChat, AI_CHAT_STORAGE_KEY) ?? AI_CHAT_STORAGE_KEY
}

export function readAiChatState(storage: Storage = localStorage): AiChatPersistenceState | null {
    if (!canReadResource(UserResource.AiChat)) return null
    if (!canPersistLocalResource(UserResource.AiChat)) return null
    try {
        const raw = storage.getItem(resolveAiChatStorageKey())
        if (!raw) return null
        return normalizeAiChatState(JSON.parse(raw))
    } catch {
        return null
    }
}

export function writeAiChatState(
    state: AiChatPersistenceState,
    storage: Storage = localStorage,
): boolean {
    if (!canPersistLocalResource(UserResource.AiChat)) return true
    let payload = buildAiChatPersistenceState(state.sessions, state.activeSessionId)
    const storageKey = resolveAiChatStorageKey()
    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            storage.setItem(storageKey, JSON.stringify(payload))
            return true
        } catch {
            if (payload.sessions.length <= 1) return false
            const nextSessions = payload.sessions.slice(0, Math.max(1, payload.sessions.length - 5))
            payload = {
                ...payload,
                sessions: nextSessions,
                activeSessionId:
                    payload.activeSessionId &&
                    nextSessions.some((item) => item.id === payload.activeSessionId)
                        ? payload.activeSessionId
                        : nextSessions[0]?.id ?? null,
            }
        }
    }
    return false
}
