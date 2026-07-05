/**
 * 为桌面版后端生成 AppCDS 类共享缓存（datawise.jsa），缩短 JVM 冷启动。
 *
 * 训练一次完整启动 → 健康检查通过 → 正常退出写入 .jsa
 * 运行时 java 加 -XX:SharedArchiveFile=... 加载（见 backend-service.ts）
 *
 * 由 prepare-desktop-bundle.mjs 在 JAR + JRE 就绪后调用。
 */
import {spawn, execSync} from 'node:child_process'
import {existsSync, rmSync, statSync, readFileSync} from 'node:fs'
import http from 'node:http'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const ports = JSON.parse(readFileSync(join(frontendRoot, 'runtime-ports.json'), 'utf8'))
const backendOut = join(frontendRoot, 'resources/desktop/backend')
const configDir = join(frontendRoot, 'resources/desktop/config-bundle')
const jar = join(backendOut, 'datawise-server.jar')
const java = join(
    backendOut,
    'jre',
    'bin',
    process.platform === 'win32' ? 'java.exe' : 'java',
)
const jcmd = join(
    backendOut,
    'jre',
    'bin',
    process.platform === 'win32' ? 'jcmd.exe' : 'jcmd',
)
const archivePath = join(backendOut, 'datawise.jsa')

const TRAIN_PORT = ports.cdsTrain
const HEALTH_URL = `http://127.0.0.1:${TRAIN_PORT}/api/health`
const STARTUP_TIMEOUT_MS = 180_000
const POLL_MS = 400

function log(msg) {
    console.log(`[build-app-cds] ${msg}`)
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function sharedJvmArgs() {
    return [
        '-Xms64m',
        '-Xmx768m',
        '-XX:TieredStopAtLevel=1',
        '-XX:+UseParallelGC',
        '-Djava.awt.headless=true',
        '-Dspring.jmx.enabled=false',
        '-Dspring.backgroundpreinitializer.ignore=true',
    ]
}

function pingHealth(url) {
    return new Promise((resolve) => {
        const req = http.get(url, {timeout: 3000}, (res) => {
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

function requestShutdown(port) {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port,
                path: '/actuator/shutdown',
                method: 'POST',
                timeout: 10_000,
            },
            (res) => {
                res.resume()
                resolve(res.statusCode ?? 0)
            },
        )
        req.on('error', reject)
        req.on('timeout', () => {
            req.destroy()
            reject(new Error('shutdown request timed out'))
        })
        req.end()
    })
}

async function waitForReady(proc) {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS
    while (Date.now() < deadline) {
        if (proc.exitCode !== null) {
            throw new Error(`training JVM exited early with code ${proc.exitCode}`)
        }
        if (await pingHealth(HEALTH_URL)) return
        await sleep(POLL_MS)
    }
    throw new Error(`training JVM did not become ready within ${STARTUP_TIMEOUT_MS / 1000}s`)
}

function exitJvmGracefully(proc) {
    if (!proc.pid || proc.exitCode !== null) return

    try {
        execSync(`"${jcmd}" ${proc.pid} VM.exit 0`, {stdio: 'ignore', windowsHide: true})
        return
    } catch {
        // jcmd attach can fail on some Windows setups — fall back to OS signal
    }

    try {
        proc.kill('SIGTERM')
    } catch {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(proc.pid), '/t'], {stdio: 'ignore', windowsHide: true})
        }
    }
}

async function waitForExit(proc, timeoutMs = 30_000) {
    if (proc.exitCode !== null) return proc.exitCode
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('JVM did not exit after CDS dump')), timeoutMs)
        proc.once('exit', (code) => {
            clearTimeout(timer)
            resolve(code ?? 1)
        })
    })
}

async function main() {
    if (!existsSync(jar)) {
        throw new Error(`missing ${jar} — run prepare-desktop-bundle first`)
    }
    if (!existsSync(java)) {
        throw new Error(`missing bundled java ${java}`)
    }
    if (!existsSync(configDir)) {
        throw new Error(`missing training config ${configDir}`)
    }

    rmSync(archivePath, {force: true})
    log(`training with ArchiveClassesAtExit → ${archivePath}`)

    const args = [
        ...sharedJvmArgs(),
        `-XX:ArchiveClassesAtExit=${archivePath}`,
        '-jar',
        jar,
        `--server.port=${TRAIN_PORT}`,
        '--server.address=127.0.0.1',
        `--datawise.config.dir=${configDir}`,
        '--spring.profiles.active=desktop',
        '--management.endpoint.shutdown.enabled=true',
        '--management.endpoints.web.exposure.include=health,shutdown',
        '--server.shutdown=graceful',
    ]

    const proc = spawn(java, args, {
        cwd: backendOut,
        env: {...process.env, JAVA_TOOL_OPTIONS: ''},
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    })

    proc.stdout?.on('data', (chunk) => process.stdout.write(chunk))
    proc.stderr?.on('data', (chunk) => process.stderr.write(chunk))

    await waitForReady(proc)
    log('backend ready — requesting graceful shutdown for CDS dump')

    const shutdownStatus = await requestShutdown(TRAIN_PORT)
    if (shutdownStatus < 200 || shutdownStatus >= 300) {
        log(`actuator shutdown returned ${shutdownStatus}, trying jcmd/signal fallback`)
        exitJvmGracefully(proc)
    }

    const exitCode = await waitForExit(proc)
    if (exitCode !== 0 && !existsSync(archivePath)) {
        throw new Error(`training JVM exited with code ${exitCode}`)
    }
    if (!existsSync(archivePath)) {
        throw new Error('CDS archive file was not created')
    }

    const sizeMb = statSync(archivePath).size / (1024 * 1024)
    log(`wrote ${archivePath} (${sizeMb.toFixed(1)} MB)`)
}

try {
    await main()
} catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[build-app-cds] skipped: ${message}`)
    rmSync(archivePath, {force: true})
    process.exit(0)
}
