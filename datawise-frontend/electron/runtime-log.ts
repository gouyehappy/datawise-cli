/**
 * 桌面版统一运行日志：后端 JVM、Electron 主进程、渲染进程关键事件 → config/logs/datawise.log
 */
import {appendFileSync, createWriteStream, mkdirSync, type WriteStream} from 'node:fs'
import {join} from 'node:path'

export const RUNTIME_LOG_FILE = 'datawise.log'

export function resolveRuntimeLogPath(configDir: string): string {
    const logDir = join(configDir, 'logs')
    mkdirSync(logDir, {recursive: true})
    return join(logDir, RUNTIME_LOG_FILE)
}

export function appendRuntimeLog(configDir: string, source: string, message: string): void {
    try {
        const logPath = resolveRuntimeLogPath(configDir)
        appendFileSync(logPath, `${formatLogLine(source, message)}\n`, 'utf8')
    } catch {
        // ignore logging failures
    }
}

export function appendRuntimeLogBlock(configDir: string, source: string, lines: string[]): void {
    try {
        const logPath = resolveRuntimeLogPath(configDir)
        const body = lines.map((line) => formatLogLine(source, line)).join('\n')
        appendFileSync(logPath, `${body}\n`, 'utf8')
    } catch {
        // ignore logging failures
    }
}

function formatLogLine(source: string, message: string): string {
    return `${new Date().toISOString()} [${source}] ${message}`
}

let backendLogStream: WriteStream | null = null
let backendLogFilePath: string | null = null

export function getBackendLogFilePath(): string | null {
    return backendLogFilePath
}

export function openBackendRuntimeLog(configDir: string): WriteStream {
    backendLogFilePath = resolveRuntimeLogPath(configDir)
    backendLogStream = createWriteStream(backendLogFilePath, {flags: 'a'})
    appendRuntimeLog(configDir, 'desktop', '--- desktop session start ---')
    return backendLogStream
}

export function writeBackendProcessLine(prefix: 'stdout' | 'stderr', chunk: Buffer | string): void {
    const text = chunk.toString()
    process.stdout.write(`[backend] ${text}`)
    if (!backendLogStream) return
    const stamp = new Date().toISOString()
    for (const part of text.split(/\r?\n/)) {
        if (!part.trim()) continue
        backendLogStream.write(`${stamp} [backend:${prefix}] ${part}\n`)
    }
}

export function closeBackendRuntimeLog(): void {
    backendLogStream?.end()
    backendLogStream = null
}
