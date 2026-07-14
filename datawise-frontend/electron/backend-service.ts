/**
 * 打包版 Electron：启动内嵌 Spring Boot 后端，退出时回收 JVM。
 * 开发模式不托管后端（沿用 mvn spring-boot:run + dev:electron）。
 */
import {type ChildProcess, spawn} from 'node:child_process'
import {existsSync, mkdirSync, cpSync, writeFileSync, readFileSync} from 'node:fs'
import http from 'node:http'
import {dirname, isAbsolute, join} from 'node:path'
import {app, dialog} from 'electron'
import {readDesktopPreferences} from './desktop-preferences'
import {touchRecentWorkspace} from './workspace-preferences'
import {ensureWindowsFirewallRule} from './win-firewall'
import {
    appendRuntimeLog,
    appendRuntimeLogBlock,
    closeBackendRuntimeLog,
    getBackendLogFilePath,
    openBackendRuntimeLog,
    resolveRuntimeLogPath,
    writeBackendProcessLine,
} from './runtime-log'
import ports from '../runtime-ports.json' with {type: 'json'}

const BACKEND_PACKAGED_PORT = ports.desktop.backend
const HEALTH_PATH = '/api/health'
const STARTUP_TIMEOUT_MS = 120_000
const HEALTH_POLL_MS = 150
const CDS_ARCHIVE_NAME = 'datawise.jsa'

let backendProcess: ChildProcess | null = null
let runtimeConfigDir = ''
const backendLogTail: string[] = []
const BACKEND_LOG_TAIL_MAX = 40

export type BackendStartupPhase = 'idle' | 'config' | 'spawning' | 'warming' | 'ready' | 'failed'

export interface BackendStartupEvent {
    phase: BackendStartupPhase
    progress: number
}

const PHASE_BASE_PROGRESS: Record<BackendStartupPhase, number> = {
    idle: 0,
    config: 8,
    spawning: 22,
    warming: 38,
    ready: 78,
    failed: 0,
}

/** JVM health OK；渲染进程会话/配置同步后再到 100% */
const BACKEND_READY_PROGRESS = 78
const WARMING_PROGRESS_START = 38
const WARMING_PROGRESS_CAP = BACKEND_READY_PROGRESS - 1
const TYPICAL_COLD_START_MS = 12_000

let startupProgressListener: ((event: BackendStartupEvent) => void) | null = null
let latestStartupEvent: BackendStartupEvent = {phase: 'idle', progress: 0}

export function setBackendStartupProgressListener(
    listener: ((event: BackendStartupEvent) => void) | null,
): void {
    startupProgressListener = listener
    if (listener && latestStartupEvent.phase !== 'idle') {
        listener(latestStartupEvent)
    }
}

export function getBackendStartupState(): BackendStartupEvent {
    return latestStartupEvent
}

function emitBackendStartupProgress(phase: BackendStartupPhase, progress?: number) {
    latestStartupEvent = {
        phase,
        progress: progress ?? PHASE_BASE_PROGRESS[phase],
    }
    startupProgressListener?.(latestStartupEvent)
}

export function getBundledApiBaseUrl(): string {
    return `http://127.0.0.1:${BACKEND_PACKAGED_PORT}`
}

function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function resolveBackendRoot(): string {
    if (app.isPackaged) {
        return join(process.resourcesPath, 'backend')
    }
    return join(app.getAppPath(), '..', 'datawise-backend', 'datawise-server', 'target')
}

function resolveConfigTemplateRoot(): string {
    return join(process.resourcesPath, 'config-bundle')
}

export function resolveConfiguredConfigPath(configured: string): string {
    const trimmed = configured.trim()
    if (!trimmed) return resolveDefaultConfigDir()
    if (isAbsolute(trimmed)) return trimmed
    return join(dirname(process.execPath), trimmed)
}

/** 未自定义时的默认工作区目录 */
export function resolveDefaultConfigDir(): string {
    if (!app.isPackaged) {
        return join(app.getAppPath(), '..', 'config')
    }

    const portableDir = process.env.PORTABLE_EXECUTABLE_DIR?.trim()
    if (portableDir) {
        return join(portableDir, 'config')
    }

    // 安装版：放在 userData，重装/升级不会随安装目录被覆盖
    return join(app.getPath('userData'), 'config')
}

/** 当前生效的工作区目录（一套配置对应一个路径） */
export function resolveRuntimeConfigDir(): string {
    if (!app.isPackaged) {
        return join(app.getAppPath(), '..', 'config')
    }

    const configured = readDesktopPreferences().configDir?.trim()
    if (configured) {
        return resolveConfiguredConfigPath(configured)
    }

    return resolveDefaultConfigDir()
}

function hasExistingConfig(dir: string): boolean {
    return existsSync(join(dir, 'users.json'))
        || existsSync(join(dir, 'connections.xml'))
        || existsSync(join(dir, 'sessions.json'))
}

function seedConfigDirectoryFromTemplate(configDir: string) {
    const template = resolveConfigTemplateRoot()
    if (!existsSync(template)) {
        throw new Error(`Config template missing: ${template}`)
    }
    mkdirSync(configDir, {recursive: true})
    cpSync(template, configDir, {recursive: true})
    const logDir = join(configDir, 'logs')
    mkdirSync(logDir, {recursive: true})
    appendRuntimeLog(configDir, 'desktop', `workspaceInitializedFromTemplate=${template}`)
}

function ensureConfigSubdirectories(configDir: string) {
    for (const sub of ['logs', 'plugins', 'drivers', 'cache/schema', 'scripts', 'ai-checkpoints']) {
        mkdirSync(join(configDir, sub), {recursive: true})
    }
}

/**
 * 初始化工作区目录：每个路径是一套独立配置，互不迁移。
 * 目录尚无配置时从内置模板生成默认工作区；已有配置则原样使用。
 */
export function bootstrapConfigDirectory(configDir: string) {
    if (!hasExistingConfig(configDir)) {
        seedConfigDirectoryFromTemplate(configDir)
    }
    repairBundledConfigFiles(configDir)
    ensureConfigSubdirectories(configDir)
}

function resolveJavaExecutable(): string {
    const backendRoot = resolveBackendRoot()
    const winJava = join(backendRoot, 'jre', 'bin', 'java.exe')
    const unixJava = join(backendRoot, 'jre', 'bin', 'java')
    if (process.platform === 'win32' && existsSync(winJava)) return winJava
    if (existsSync(unixJava)) return unixJava
    return process.platform === 'win32' ? 'java.exe' : 'java'
}

function resolveServerJar(): string {
    if (app.isPackaged) {
        return join(resolveBackendRoot(), 'datawise-server.jar')
    }
    return join(resolveBackendRoot(), 'datawise-server-0.1.0-SNAPSHOT.jar')
}

function ensureRuntimeConfigDir(): string {
    const configDir = resolveRuntimeConfigDir()
    bootstrapConfigDirectory(configDir)
    if (app.isPackaged) {
        touchRecentWorkspace(configDir)
    }
    runtimeConfigDir = configDir
    return configDir
}

/** 修复旧版打包模板中的错误 teams.json（[] 应为对象快照） */
function repairBundledConfigFiles(configDir: string) {
    const teamsPath = join(configDir, 'teams.json')
    if (!existsSync(teamsPath)) return
    const raw = readFileSync(teamsPath, 'utf8').trim()
    if (!raw.startsWith('[')) return

    const templateTeams = join(resolveConfigTemplateRoot(), 'teams.json')
    if (existsSync(templateTeams)) {
        cpSync(templateTeams, teamsPath)
        return
    }
    writeFileSync(
        teamsPath,
        JSON.stringify({
            teams: [],
            members: [],
            invites: [],
            auditLogs: [],
            sharedAiSessions: [],
            sharedQueries: [],
        }, null, 2),
        'utf8',
    )
}

function writeStartupDiagnostics(configDir: string, java: string, jar: string) {
    appendRuntimeLogBlock(configDir, 'desktop', [
        'backend startup diagnostics',
        `execPath=${process.execPath}`,
        `appPath=${app.getAppPath()}`,
        `configDir=${configDir}`,
        `java=${java}`,
        `jar=${jar}`,
        `cdsArchive=${resolveCdsArchivePath() ?? 'none'}`,
        `runtimeLog=${resolveRuntimeLogPath(configDir)}`,
    ])
}

export function appendDesktopStartupLog(message: string): void {
    try {
        const configDir = runtimeConfigDir || resolveRuntimeConfigDir()
        appendRuntimeLog(configDir, 'desktop', message)
    } catch {
        // ignore logging failures
    }
}

function openBackendLog(configDir: string) {
    openBackendRuntimeLog(configDir)
}

function logBackendLine(prefix: 'stdout' | 'stderr', chunk: Buffer) {
    writeBackendProcessLine(prefix, chunk)
    for (const part of chunk.toString().split(/\r?\n/)) {
        if (!part.trim()) continue
        backendLogTail.push(part)
    }
    if (backendLogTail.length > BACKEND_LOG_TAIL_MAX) {
        backendLogTail.splice(0, backendLogTail.length - BACKEND_LOG_TAIL_MAX)
    }
}

async function pingHealth(baseUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
        const req = http.get(`${baseUrl}${HEALTH_PATH}`, {timeout: 3000}, (res) => {
            res.resume()
            resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300)
        })
        req.on('error', () => resolve(false))
        req.on('timeout', () => {
            req.destroy()
            resolve(false)
        })
    })
}

function warmingProgressFromElapsed(elapsedMs: number): number {
    const ratio = 1 - Math.exp(-elapsedMs / TYPICAL_COLD_START_MS)
    return Math.min(
        WARMING_PROGRESS_CAP,
        WARMING_PROGRESS_START + Math.round((WARMING_PROGRESS_CAP - WARMING_PROGRESS_START) * ratio),
    )
}

function emitBackendReady() {
    emitBackendStartupProgress('ready', BACKEND_READY_PROGRESS)
}

async function waitForBackendReady(baseUrl: string): Promise<void> {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS
    const started = Date.now()
    emitBackendStartupProgress('warming', WARMING_PROGRESS_START)

    while (Date.now() < deadline) {
        if (await pingHealth(baseUrl)) {
            emitBackendReady()
            return
        }
        if (backendProcess && backendProcess.exitCode !== null) {
            emitBackendStartupProgress('failed')
            throw new Error(`Backend exited with code ${backendProcess.exitCode}`)
        }
        emitBackendStartupProgress('warming', warmingProgressFromElapsed(Date.now() - started))
        await sleep(HEALTH_POLL_MS)
    }
    emitBackendStartupProgress('failed')
    throw new Error(`Backend did not become ready within ${STARTUP_TIMEOUT_MS / 1000}s`)
}

function resolveCdsArchivePath(): string | null {
    const archive = join(resolveBackendRoot(), CDS_ARCHIVE_NAME)
    return existsSync(archive) ? archive : null
}

function buildJvmArgs(): string[] {
    const args = [
        '-Xms64m',
        '-Xmx768m',
        '-XX:TieredStopAtLevel=1',
        '-XX:+UseParallelGC',
        '-Djava.awt.headless=true',
        '-Dspring.jmx.enabled=false',
        '-Dspring.backgroundpreinitializer.ignore=true',
    ]
    const cdsArchive = resolveCdsArchivePath()
    if (cdsArchive) {
        // AppCDS 与 plugins/*.jar 自定义 ClassLoader 并存时会刷 Duplicated unregistered class；
        // 这不影响功能，只保留 error 级（例如 archive 映射失败）。
        args.push(`-XX:SharedArchiveFile=${cdsArchive}`, '-Xlog:cds=error')
    }
    return args
}

function buildBackendArgs(configDir: string, jar: string): string[] {
    return [
        ...buildJvmArgs(),
        '-jar',
        jar,
        `--server.port=${BACKEND_PACKAGED_PORT}`,
        '--server.address=127.0.0.1',
        `--datawise.config.dir=${configDir}`,
        '--spring.profiles.active=desktop',
    ]
}

async function tryReuseExistingBackend(apiBase: string): Promise<boolean> {
    if (!(await pingHealth(apiBase))) return false
    emitBackendStartupProgress('config')
    emitBackendStartupProgress('spawning', PHASE_BASE_PROGRESS.spawning)
    emitBackendStartupProgress('warming', 58)
    emitBackendReady()
    process.env.DATAWISE_API_BASE_URL = apiBase
    return true
}

function spawnBundledBackendProcess(java: string, args: string[]): void {
    backendProcess = spawn(java, args, {
        cwd: dirname(process.execPath),
        env: {
            ...process.env,
            JAVA_TOOL_OPTIONS: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    })

    backendProcess.stdout?.on('data', (chunk: Buffer) => logBackendLine('stdout', chunk))
    backendProcess.stderr?.on('data', (chunk: Buffer) => logBackendLine('stderr', chunk))
    backendProcess.on('exit', (code) => {
        if (code !== null && code !== 0) {
            console.error(`[backend] exited with code ${code}`)
        }
        backendProcess = null
    })
}

export async function startBundledBackendInBackground(): Promise<boolean> {
    if (!app.isPackaged) {
        emitBackendReady()
        return true
    }

    const apiBase = getBundledApiBaseUrl()
    if (await tryReuseExistingBackend(apiBase)) {
        return true
    }

    try {
        await startBundledBackend()
        return true
    } catch (error) {
        emitBackendStartupProgress('failed')
        const message = error instanceof Error ? error.message : String(error)
        console.error('[backend] startup failed:', message)

        const configDir = runtimeConfigDir || resolveRuntimeConfigDir()
        const logHint = getBackendLogFilePath() || resolveRuntimeLogPath(configDir)
        const tail = backendLogTail.slice(-6).join('\n')
        const detail = [
            message,
            '',
            `配置目录：\n${configDir}`,
            '',
            `运行日志：\n${logHint}`,
            tail ? `\n最近输出：\n${tail}` : '',
        ].join('\n')

        await dialog.showErrorBox('DataWise CLI', `无法启动内嵌后端服务。\n\n${detail}`)
        return false
    }
}

export async function startBundledBackend(): Promise<string> {
    if (!app.isPackaged) {
        return getBundledApiBaseUrl()
    }

    const jar = resolveServerJar()
    if (!existsSync(jar)) {
        throw new Error(`Backend JAR not found: ${jar}`)
    }

    emitBackendStartupProgress('config')
    const configDir = ensureRuntimeConfigDir()
    openBackendLog(configDir)

    const java = resolveJavaExecutable()
    const apiBase = getBundledApiBaseUrl()
    writeStartupDiagnostics(configDir, java, jar)
    ensureWindowsFirewallRule(java)

    emitBackendStartupProgress('spawning')
    spawnBundledBackendProcess(java, buildBackendArgs(configDir, jar))

    await waitForBackendReady(apiBase)
    process.env.DATAWISE_API_BASE_URL = apiBase
    return apiBase
}

export function stopBundledBackend(): void {
    closeBackendRuntimeLog()

    if (!backendProcess || backendProcess.killed) {
        backendProcess = null
        return
    }

    const proc = backendProcess
    backendProcess = null

    if (process.platform === 'win32' && proc.pid) {
        spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], {stdio: 'ignore', windowsHide: true})
        return
    }
    proc.kill('SIGTERM')
}

/** @deprecated 使用 startBundledBackendInBackground */
export async function startBundledBackendOrNotify(): Promise<boolean> {
    return startBundledBackendInBackground()
}
