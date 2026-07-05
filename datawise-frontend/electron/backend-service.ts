/**
 * 打包版 Electron：启动内嵌 Spring Boot 后端，退出时回收 JVM。
 * 开发模式不托管后端（沿用 mvn spring-boot:run + dev:electron）。
 */
import {type ChildProcess, spawn} from 'node:child_process'
import {createWriteStream, existsSync, mkdirSync, cpSync, writeFileSync, readFileSync, appendFileSync} from 'node:fs'
import http from 'node:http'
import {dirname, isAbsolute, join} from 'node:path'
import {app, dialog} from 'electron'
import {readDesktopPreferences} from './desktop-preferences'
import {touchRecentWorkspace} from './workspace-preferences'
import {ensureWindowsFirewallRule} from './win-firewall'
import ports from '../runtime-ports.json' with {type: 'json'}

const BACKEND_PORT = ports.backend
const HEALTH_PATH = '/api/health'
const STARTUP_TIMEOUT_MS = 120_000
const HEALTH_POLL_MS = 150
const CDS_ARCHIVE_NAME = 'datawise.jsa'

let backendProcess: ChildProcess | null = null
let backendLogStream: ReturnType<typeof createWriteStream> | null = null
let backendLogPath = ''
let runtimeConfigDir = ''
const backendLogTail: string[] = []
const BACKEND_LOG_TAIL_MAX = 40

export function getBundledApiBaseUrl(): string {
    return `http://127.0.0.1:${BACKEND_PORT}`
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
    appendFileSync(
        join(logDir, 'desktop-startup.log'),
        `workspaceInitializedFromTemplate=${template}\n`,
        'utf8',
    )
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
    const logPath = join(configDir, 'logs', 'desktop-startup.log')
    mkdirSync(join(configDir, 'logs'), {recursive: true})
    const lines = [
        `time=${new Date().toISOString()}`,
        `execPath=${process.execPath}`,
        `appPath=${app.getAppPath()}`,
        `configDir=${configDir}`,
        `java=${java}`,
        `jar=${jar}`,
        `cdsArchive=${resolveCdsArchivePath() ?? 'none'}`,
        `backendLog=${join(configDir, 'logs', 'electron-backend.log')}`,
        `datawiseLog=${join(configDir, 'logs', 'datawise.log')}`,
        '',
    ]
    appendFileSync(logPath, lines.join('\n'), 'utf8')
}

export function appendDesktopStartupLog(message: string): void {
    try {
        const configDir = runtimeConfigDir || resolveRuntimeConfigDir()
        const logPath = join(configDir, 'logs', 'desktop-startup.log')
        mkdirSync(join(configDir, 'logs'), {recursive: true})
        appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, 'utf8')
    } catch {
        // ignore logging failures
    }
}

function openBackendLog(configDir: string) {
    const logDir = join(configDir, 'logs')
    mkdirSync(logDir, {recursive: true})
    backendLogPath = join(logDir, 'electron-backend.log')
    backendLogStream = createWriteStream(backendLogPath, {flags: 'a'})
}

function logBackendLine(prefix: string, chunk: Buffer) {
    const line = chunk.toString()
    process.stdout.write(`[backend] ${line}`)
    backendLogStream?.write(`[${prefix}] ${line}`)
    for (const part of line.split(/\r?\n/)) {
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

async function waitForBackendReady(baseUrl: string): Promise<void> {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS
    while (Date.now() < deadline) {
        if (await pingHealth(baseUrl)) return
        if (backendProcess && backendProcess.exitCode !== null) {
            throw new Error(`Backend exited with code ${backendProcess.exitCode}`)
        }
        await sleep(HEALTH_POLL_MS)
    }
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
        args.push(`-XX:SharedArchiveFile=${cdsArchive}`)
    }
    return args
}

function buildBackendArgs(configDir: string, jar: string): string[] {
    return [
        ...buildJvmArgs(),
        '-jar',
        jar,
        `--server.port=${BACKEND_PORT}`,
        '--server.address=127.0.0.1',
        `--datawise.config.dir=${configDir}`,
        '--spring.profiles.active=desktop',
    ]
}

async function tryReuseExistingBackend(apiBase: string): Promise<boolean> {
    if (!(await pingHealth(apiBase))) return false
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

    backendProcess.stdout?.on('data', (chunk: Buffer) => logBackendLine('out', chunk))
    backendProcess.stderr?.on('data', (chunk: Buffer) => logBackendLine('err', chunk))
    backendProcess.on('exit', (code) => {
        if (code !== null && code !== 0) {
            console.error(`[backend] exited with code ${code}`)
        }
        backendProcess = null
    })
}

export async function startBundledBackendInBackground(): Promise<boolean> {
    if (!app.isPackaged) {
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
        const message = error instanceof Error ? error.message : String(error)
        console.error('[backend] startup failed:', message)

        const configDir = runtimeConfigDir || resolveRuntimeConfigDir()
        const logHint = backendLogPath || join(configDir, 'logs', 'electron-backend.log')
        const startupLog = join(configDir, 'logs', 'desktop-startup.log')
        const tail = backendLogTail.slice(-6).join('\n')
        const detail = [
            message,
            '',
            `配置目录：\n${configDir}`,
            '',
            `启动日志：\n${startupLog}`,
            '',
            `后端输出：\n${logHint}`,
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

    const configDir = ensureRuntimeConfigDir()
    openBackendLog(configDir)

    const java = resolveJavaExecutable()
    const apiBase = getBundledApiBaseUrl()
    writeStartupDiagnostics(configDir, java, jar)
    ensureWindowsFirewallRule(java)
    spawnBundledBackendProcess(java, buildBackendArgs(configDir, jar))

    await waitForBackendReady(apiBase)
    process.env.DATAWISE_API_BASE_URL = apiBase
    return apiBase
}

export function stopBundledBackend(): void {
    backendLogStream?.end()
    backendLogStream = null

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
