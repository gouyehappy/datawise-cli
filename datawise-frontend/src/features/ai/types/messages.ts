import type {AiDatabaseTarget} from '@/features/ai/shared/utils/database-targets'
import type {AiAnalysisResult, AiAnalysisStepEvent} from '@/features/ai/types/analysis'

export interface AiChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    time: string
    kind?: 'welcome'
    analysis?: AiAnalysisResult
    /** Persisted workflow steps for analysis replies (shown collapsed on the report). */
    analysisSteps?: AiAnalysisStepEvent[]
    databases?: Pick<
        AiDatabaseTarget,
        'id' | 'connectionLabel' | 'databaseLabel' | 'tableLabel' | 'dbType' | 'level'
    >[]
}

export type MessageBlock =
    | { type: 'text'; text: string }
    | { type: 'code'; code: string }
    | { type: 'list'; items: string[] }
