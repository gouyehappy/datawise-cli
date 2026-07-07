import type {ApiResponse} from '@/shared/api/types'
import {readApiBaseUrl} from '@/shared/api/mode'
import {notifyApiError} from '@/shared/api/http/api-error-notifier'
import {resolveApiErrorMessage} from '@/shared/api/http/api-error-message'

export const HTTP_NOT_READY =
    'HTTP API request failed. Ensure the backend is running and Vite proxy is configured.'

export type HttpRequestOptions = {
    /** 不弹出全局错误 Toast（调用方自行展示） */
    silent?: boolean
    /** 请求超时（毫秒）；0 表示不限制 */
    timeoutMs?: number
}

const DEFAULT_FETCH_TIMEOUT_MS = 60_000

function fetchSignal(timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): AbortSignal | undefined {
    if (timeoutMs <= 0) return undefined
    return AbortSignal.timeout(timeoutMs)
}

/** 带结构化 data 的 API 错误（如 SQL errorLine） */
export class ApiError extends Error {
    readonly data?: unknown

    constructor(message: string, data?: unknown) {
        super(message)
        this.name = 'ApiError'
        this.data = data
    }
}

async function readApiPayload<T>(response: Response): Promise<ApiResponse<T>> {
    try {
        return (await response.json()) as ApiResponse<T>
    } catch {
        throw new ApiError(response.ok ? HTTP_NOT_READY : `HTTP ${response.status}`)
    }
}

function rejectApiError(
    payload: ApiResponse<unknown>,
    options?: HttpRequestOptions,
): never {
    const message = payload.msg?.trim() || HTTP_NOT_READY
    const error = new ApiError(message, payload.data)
    notifyApiError(error, options)
    throw error
}

async function ensureApiSuccess<T>(
    response: Response,
    options?: HttpRequestOptions,
): Promise<ApiResponse<T>> {
    const payload = await readApiPayload<T>(response)
    if (!response.ok || payload.code !== 0) {
        rejectApiError(payload, options)
    }
    return payload
}

async function runFetch<T>(
    execute: (signal?: AbortSignal) => Promise<Response>,
    options?: HttpRequestOptions,
): Promise<T> {
    const signal = fetchSignal(options?.timeoutMs)
    let response: Response
    try {
        response = await execute(signal)
    } catch {
        const error = new ApiError(HTTP_NOT_READY)
        notifyApiError(error, options)
        throw error
    }

    try {
        const payload = await ensureApiSuccess<T>(response, options)
        return payload.data
    } catch (error) {
        if (error instanceof ApiError) {
            throw error
        }
        const apiError = new ApiError(resolveApiErrorMessage(error))
        notifyApiError(apiError, options)
        throw apiError
    }
}

export function requireBaseUrl(): string {
    return readApiBaseUrl()
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

function mergeHeaders(headers?: Record<string, string>): Record<string, string> {
    return {...sessionHeaders(), ...headers}
}

export async function postForm<T>(
    path: string,
    body: URLSearchParams,
    options?: HttpRequestOptions,
): Promise<T> {
    return runFetch(
        (signal) =>
            fetch(buildUrl(path), {
                method: 'POST',
                headers: mergeHeaders({'Content-Type': 'application/x-www-form-urlencoded'}),
                body,
                credentials: 'include',
                signal,
            }),
        options,
    )
}

export async function postJson<T>(
    path: string,
    body: unknown,
    options?: HttpRequestOptions,
): Promise<T> {
    return runFetch(
        (signal) =>
            fetch(buildUrl(path), {
                method: 'POST',
                headers: mergeHeaders({'Content-Type': 'application/json'}),
                body: JSON.stringify(body),
                credentials: 'include',
                signal,
            }),
        options,
    )
}

export async function getJson<T>(
    path: string,
    query?: Record<string, string | undefined>,
    options?: HttpRequestOptions,
): Promise<T> {
    const params = new URLSearchParams()
    if (query) {
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== '') params.set(key, value)
        }
    }
    const qs = params.toString()
    let url = buildUrl(path)
    if (qs) {
        url += path.includes('?') ? `&${qs}` : `?${qs}`
    }
    return runFetch(
        (signal) =>
            fetch(url, {
                method: 'GET',
                headers: sessionHeaders(),
                credentials: 'include',
                signal,
            }),
        options,
    )
}

export async function putJson<T>(
    path: string,
    body: unknown,
    options?: HttpRequestOptions,
): Promise<T> {
    return runFetch(
        (signal) =>
            fetch(buildUrl(path), {
                method: 'PUT',
                headers: mergeHeaders({'Content-Type': 'application/json'}),
                body: JSON.stringify(body),
                credentials: 'include',
                signal,
            }),
        options,
    )
}

export async function deleteJson<T>(path: string, options?: HttpRequestOptions): Promise<T> {
    return runFetch(
        (signal) =>
            fetch(buildUrl(path), {
                method: 'DELETE',
                headers: sessionHeaders(),
                credentials: 'include',
                signal,
            }),
        options,
    )
}

export function notReady<T>(): Promise<T> {
    return Promise.reject(new Error(HTTP_NOT_READY))
}
