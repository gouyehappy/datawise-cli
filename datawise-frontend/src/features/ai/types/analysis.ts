import type {TableColumn, TableRow} from '@/core/types'

export interface AiChartSpec {
    type: 'bar' | 'line' | 'pie'
    title: string
    xField: string
    yFields: string[]
    seriesNames: string[]
}

export interface AiAnalysisReport {
    markdown: string
    html?: string | null
}

export interface AiAnalysisResult {
    sql: string
    columns: TableColumn[]
    rows: TableRow[]
    chart?: AiChartSpec | null
    report?: AiAnalysisReport | null
    pythonInsight?: string | null
}

export interface AiAnalysisContextPayload {
    previousSql: string
    previousSummary?: string
    previousChartType?: string
}

export interface AiChatReplyPayload {
    reply: string
    mode?: 'chat' | 'analysis'
    sql?: string | null
    columns?: TableColumn[]
    rows?: TableRow[]
    chart?: AiChartSpec | null
    report?: AiAnalysisReport | null
    pythonInsight?: string | null
}

export interface AiAnalysisInterruptPayload {
    threadId: string
    checkpointId: string
    sql: string
    nextStep: string
}

export interface AiAnalysisResumeRequest {
    threadId: string
    checkpointId: string
    approved: boolean
}

export type AiAnalysisStepStatus = 'running' | 'ok' | 'failed' | 'skipped'

export interface AiAnalysisStepEvent {
    step: string
    status: AiAnalysisStepStatus
    message: string
    durationMs?: number | null
    detail?: Record<string, unknown> | null
}

export const AI_ANALYSIS_STEP_ORDER = [
    'intent',
    'step_route',
    'planner',
    'evidence',
    'schema',
    'sql_generate',
    'sql_validate',
    'sql_execute',
    'python_generate',
    'python_execute',
    'python_analyze',
    'chart',
    'summary',
    'report',
] as const

export type AiAnalysisStepId = (typeof AI_ANALYSIS_STEP_ORDER)[number]

/** 可在设置中禁用的可选分析步骤（与后端 datawise.ai.analysis.steps 对齐） */
export const AI_ANALYSIS_CONFIGURABLE_STEPS = [
    'planner',
    'evidence',
    'sql_validate',
    'python',
    'chart',
    'summary',
    'report',
] as const

export type AiAnalysisConfigurableStepId = (typeof AI_ANALYSIS_CONFIGURABLE_STEPS)[number]

export type AiAnalysisMode = 'quick' | 'smart' | 'custom'
