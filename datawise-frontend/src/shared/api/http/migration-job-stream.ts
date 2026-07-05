import {parseSseBlock} from '@/features/ai/analysis/services/analysis-stream-parser.service'
import {readApiBaseUrl} from '@/shared/api/mode'
import {ApiError} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'
import type {MigrationJobView, TableMigrationResult} from '@/shared/api/types'
import type {
    TableMigrationTableBatchProgressEvent,
    TableMigrationTableResultEvent,
    TableMigrationTableStartEvent,
} from '@/shared/api/http/migration-stream'

export interface MigrationJobStreamHandlers {
    onJobSnapshot?: (view: MigrationJobView) => void
    onTableStart?: (event: TableMigrationTableStartEvent) => void
    onTableResult?: (event: TableMigrationTableResultEvent) => void
    onBatchProgress?: (event: TableMigrationTableBatchProgressEvent) => void
    onJobPaused?: (view: MigrationJobView) => void
    onJobDone?: (view: MigrationJobView) => void
    onError?: (message: string) => void
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

async function getMigrationJobSse(jobId: string): Promise<Response> {
    let response: Response
    try {
        response = await fetch(buildUrl(API_PATHS.migration.jobStream(jobId)), {
            method: 'GET',
            headers: {
                Accept: 'text/event-stream',
                ...sessionHeaders(),
            },
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

/** GET SSE：订阅迁移 job 进度，支持运行中重连。 */
export async function streamMigrationJob(
    jobId: string,
    handlers: MigrationJobStreamHandlers,
): Promise<{view: MigrationJobView; results: TableMigrationResult[]}> {
    const response = await getMigrationJobSse(jobId)
    return consumeMigrationJobSseStream(response.body!, handlers)
}

async function consumeMigrationJobSseStream(
    body: ReadableStream<Uint8Array>,
    handlers: MigrationJobStreamHandlers,
): Promise<{view: MigrationJobView; results: TableMigrationResult[]}> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let latestView: MigrationJobView | null = null

    while (true) {
        const {done, value} = await reader.read()
        if (done) break

        buffer += decoder.decode(value, {stream: true})
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? ''

        for (const block of blocks) {
            latestView = dispatchMigrationJobSseBlock(block, handlers, latestView) ?? latestView
        }
    }

    if (buffer.trim()) {
        latestView = dispatchMigrationJobSseBlock(buffer, handlers, latestView) ?? latestView
    }

    if (!latestView) {
        throw new ApiError('Migration job stream ended without a snapshot')
    }
    return {view: latestView, results: [...(latestView.results ?? [])]}
}

function dispatchMigrationJobSseBlock(
    block: string,
    handlers: MigrationJobStreamHandlers,
    latestView: MigrationJobView | null,
): MigrationJobView | null {
    const parsed = parseSseBlock(block.trim())
    if (!parsed) return null

    if (parsed.event === 'job_snapshot') {
        const view = JSON.parse(parsed.data) as MigrationJobView
        handlers.onJobSnapshot?.(view)
        return view
    }
    if (parsed.event === 'table_start') {
        handlers.onTableStart?.(JSON.parse(parsed.data) as TableMigrationTableStartEvent)
        return latestView
    }
    if (parsed.event === 'table_result') {
        handlers.onTableResult?.(JSON.parse(parsed.data) as TableMigrationTableResultEvent)
        return latestView
    }
    if (parsed.event === 'batch_progress') {
        handlers.onBatchProgress?.(JSON.parse(parsed.data) as TableMigrationTableBatchProgressEvent)
        return latestView
    }
    if (parsed.event === 'job_paused') {
        const view = JSON.parse(parsed.data) as MigrationJobView
        handlers.onJobPaused?.(view)
        handlers.onJobSnapshot?.(view)
        return view
    }
    if (parsed.event === 'job_done') {
        const view = JSON.parse(parsed.data) as MigrationJobView
        handlers.onJobDone?.(view)
        handlers.onJobSnapshot?.(view)
        return view
    }
    if (parsed.event === 'error') {
        const payload = JSON.parse(parsed.data) as {message?: string}
        handlers.onError?.(payload.message ?? 'Migration failed')
    }
    return latestView
}

/** 测试用：将 SSE 文本编码为 ReadableStream */
export function encodeMigrationJobSseText(text: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    return new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(text))
            controller.close()
        },
    })
}

export async function consumeMigrationJobSseStreamForTest(
    body: ReadableStream<Uint8Array>,
    handlers: MigrationJobStreamHandlers,
): Promise<{view: MigrationJobView; results: TableMigrationResult[]}> {
    return consumeMigrationJobSseStream(body, handlers)
}
