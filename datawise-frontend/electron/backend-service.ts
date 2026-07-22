/**
 * Electron 启动 Spring Boot 后端：工作区目录一律来自 desktop-preferences.json。
 * - 未配置偏好 → 系统目录 userData/workspaces
 * - 已配置 → 始终使用配置中的绝对路径
 * 开发态若已构建 server JAR，同样按偏好拉起后端（端口见 runtime-ports.dev）。
 */
import {type ChildProcess, execFileSync, spawn} from 'node:child_process'
import {existsSync, mkdirSync, cpSync, writeFileSync, readFileSync, readdirSync} from 'node:fs'
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

const HEALTH_PATH = '/api/health'
const STARTUP_TIMEOUT_MS = 120_000
const HEALTH_POLL_MS = 150
const CDS_ARCHIVE_NAME = 'datawise.jsa'

function resolveBackendListenPort(): number {
    return app.isPackaged ? ports.desktop.backend : ports.dev.backend
}

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
    return `http://127.0.0.1:${resolveBackendListenPort()}`
}

function normalizeFsPath(path: string): string {
    return path.trim().replace(/[/\\]+$/, '').replace(/\\/g, '/').toLowerCase()
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
    if (app.isPackaged) {
        // 安装包：electron-builder 从 resources/desktop/config-bundle 打进的种子
        return join(process.resourcesPath, 'config-bundle')
    }
    // 开发态：与打包同源，使用仓库内 resources/bundle-config
    return join(app.getAppPath(), 'resources', 'bundle-config')
}

export function resolveConfiguredConfigPath(configured: string): string {
    const trimmed = configured.trim()
    if (!trimmed) return resolveDefaultConfigDir()
    if (isAbsolute(trimmed)) return trimmed
    return join(dirname(process.execPath), trimmed)
}

/**
 * 未写入 desktop-preferences.json 时的默认工作区：
 * 系统目录（userData）下的 workspaces。
 */
export function resolveDefaultConfigDir(): string {
    const portableDir = process.env.PORTABLE_EXECUTABLE_DIR?.trim()
    if (portableDir) {
        return join(portableDir, 'workspaces')
    }
    return join(app.getPath('userData'), 'workspaces')
}

/** 当前应使用的工作区：始终读偏好文件；有配置用配置，否则用默认 workspaces */
export function resolveRuntimeConfigDir(): string {
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
        || existsSync(join(dir, 'tenants', 'index.json'))
        || existsSync(join(dir, 'tenants', 'default', 'connections.xml'))
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

function resolveServerJar(): string | null {
    const root = resolveBackendRoot()
    if (app.isPackaged) {
        const jar = join(root, 'datawise-server.jar')
        return existsSync(jar) ? jar : null
    }
    if (!existsSync(root)) return null
    const jars = readdirSync(root)
        .filter((name) => /^datawise-server-.*\.jar$/.test(name) && !name.endsWith('.original'))
        .sort()
    return jars.length ? join(root, jars[jars.length - 1]) : null
}

function ensureRuntimeConfigDir(): string {
    const configDir = resolveRuntimeConfigDir()
    bootstrapConfigDirectory(configDir)
    touchRecentWorkspace(configDir)
    runtimeConfigDir = configDir
    return configDir
}

const EMPTY_TEAMS_SNAPSHOT = JSON.stringify({
    teams: [],
    members: [],
    invites: [],
    auditLogs: [],
    sharedAiSessions: [],
    sharedQueries: [],
}, null, 2)

/** 修复旧版打包模板中的错误 teams.json（[] 应为对象快照） */
function repairBundledConfigFiles(configDir: string) {
    const candidates = [
        join(configDir, 'teams.json'),
        join(configDir, 'tenants', 'default', 'teams.json'),
    ]
    const templateTeams = join(resolveConfigTemplateRoot(), 'tenants', 'default', 'teams.json')
    const fallbackTemplate = join(resolveConfigTemplateRoot(), 'teams.json')

    for (const teamsPath of candidates) {
        if (!existsSync(teamsPath)) continue
        const raw = readFileSync(teamsPath, 'utf8').trim()
        if (!raw.startsWith('[')) continue

        if (existsSync(templateTeams)) {
            cpSync(templateTeams, teamsPath)
        } else if (existsSync(fallbackTemplate)) {
            cpSync(fallbackTemplate, teamsPath)
        } else {
            writeFileSync(teamsPath, EMPTY_TEAMS_SNAPSHOT, 'utf8')
        }
    }
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

type HealthProbe = {ok: boolean; configDir?: string}

async function pingHealth(baseUrl: string): Promise<boolean> {
    const probe = await probeHealth(baseUrl)
    return probe.ok
}

async function probeHealth(baseUrl: string): Promise<HealthProbe> {
    return new Promise((resolve) => {
        const req = http.get(`${baseUrl}${HEALTH_PATH}`, {timeout: 3000}, (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
            res.on('end', () => {
                const ok = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300
                if (!ok) {
                    resolve({ok: false})
                    return
                }
                try {
                    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
                        data?: {configDir?: string}
                    }
                    const configDir = body?.data?.configDir?.trim()
                    resolve({ok: true, configDir: configDir || undefined})
                } catch {
                    resolve({ok: true})
                }
            })
        })
        req.on('error', () => resolve({ok: false}))
        req.on('timeout', () => {
            req.destroy()
            resolve({ok: false})
        })
    })
}

/** 释放被错误工作区占用的监听端口，避免复用旧后端 */
function freeBackendListenPort(): void {
    const port = resolveBackendListenPort()
    try {
        if (process.platform === 'win32') {
            const out = execFileSync(
                'powershell.exe',
                [
                    '-NoProfile',
                    '-Command',
                    `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique`,
                ],
                {encoding: 'utf8', windowsHide: true},
            )
            for (const line of out.split(/\r?\n/)) {
                const pid = Number(line.trim())
                if (!Number.isFinite(pid) || pid <= 0) continue
                try {
                    execFileSync('taskkill', ['/pid', String(pid), '/t', '/f'], {
                        stdio: 'ignore',
                        windowsHide: true,
                    })
                } catch {
                    // ignore
                }
            }
            return
        }
        const out = execFileSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {encoding: 'utf8'})
        for (const line of out.split(/\r?\n/)) {
            const pid = Number(line.trim())
            if (!Number.isFinite(pid) || pid <= 0) continue
            try {
                process.kill(pid, 'SIGTERM')
            } catch {
                // ignore
            }
        }
    } catch {
        // port free or tool unavailable
    }
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
        `--server.port=${resolveBackendListenPort()}`,
        '--server.address=127.0.0.1',
        `--datawise.config.dir=${configDir}`,
        `--spring.profiles.active=${app.isPackaged ? 'desktop' : 'dev'}`,
    ]
}

async function tryReuseExistingBackend(apiBase: string, expectedConfigDir: string): Promise<boolean> {
    const probe = await probeHealth(apiBase)
    if (!probe.ok) return false

    if (probe.configDir && normalizeFsPath(probe.configDir) !== normalizeFsPath(expectedConfigDir)) {
        appendDesktopStartupLog(
            `reuse skipped: live configDir=${probe.configDir} expected=${expectedConfigDir}; freeing port`,
        )
        freeBackendListenPort()
        await sleep(400)
        return false
    }

    emitBackendStartupProgress('config')
    emitBackendStartupProgress('spawning', PHASE_BASE_PROGRESS.spawning)
    emitBackendStartupProgress('warming', 58)
    emitBackendReady()
    process.env.DATAWISE_API_BASE_URL = apiBase
    runtimeConfigDir = expectedConfigDir
    return true
}

function spawnBundledBackendProcess(java: string, args: string[]): void {
    backendProcess = spawn(java, args, {
        cwd: app.isPackaged ? dirname(process.execPath) : resolveBackendRoot(),
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
    const expectedConfigDir = resolveRuntimeConfigDir()
    runtimeConfigDir = expectedConfigDir
    const apiBase = getBundledApiBaseUrl()

    if (await tryReuseExistingBackend(apiBase, expectedConfigDir)) {
        return true
    }

    const jar = resolveServerJar()
    if (!jar) {
        // 开发态尚未打包 JAR：不阻塞启动，但写明必须用偏好工作区起后端
        if (!app.isPackaged) {
            appendDesktopStartupLog(
                `dev server jar missing under ${resolveBackendRoot()}; `
                + `start Spring Boot with --datawise.config.dir=${expectedConfigDir}`,
            )
            emitBackendReady()
            return true
        }
        emitBackendStartupProgress('failed')
        await dialog.showErrorBox(
            'DataWise CLI',
            `找不到后端 JAR：\n${join(resolveBackendRoot(), 'datawise-server.jar')}`,
        )
        return false
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
    const jar = resolveServerJar()
    if (!jar) {
        throw new Error(`Backend JAR not found under ${resolveBackendRoot()}`)
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
