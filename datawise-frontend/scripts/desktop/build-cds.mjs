/**
 * Generate AppCDS class archive for bundled backend JVM startup.
 */
import {spawn, execSync} from 'node:child_process'
import {existsSync, rmSync, statSync, readFileSync} from 'node:fs'
import http from 'node:http'
import {join} from 'node:path'
import {backendBundleOut, configBundleOut, frontendRoot} from './paths.mjs'
import {log, sleep, isDirectRun} from './lib.mjs'

const ports = JSON.parse(readFileSync(join(frontendRoot, 'runtime-ports.json'), 'utf8'))
const jar = join(backendBundleOut, 'datawise-server.jar')
const java = join(
    backendBundleOut,
    'jre',
    'bin',
    process.platform === 'win32' ? 'java.exe' : 'java',
)
const jcmd = join(
    backendBundleOut,
    'jre',
    'bin',
    process.platform === 'win32' ? 'jcmd.exe' : 'jcmd',
)
const archivePath = join(backendBundleOut, 'datawise.jsa')

const TRAIN_PORT = ports.cdsTrain
const HEALTH_URL = `http://127.0.0.1:${TRAIN_PORT}/api/health`
const STARTUP_TIMEOUT_MS = 180_000
const POLL_MS = 400

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
        // jcmd attach can fail on some Windows setups
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

export async function buildAppCds() {
    if (!existsSync(jar)) {
        throw new Error(`missing ${jar} — bundle backend first`)
    }
    if (!existsSync(java)) {
        throw new Error(`missing bundled java ${java}`)
    }
    if (!existsSync(configBundleOut)) {
        throw new Error(`missing training config ${configBundleOut}`)
    }

    rmSync(archivePath, {force: true})
    log('build-cds', `training with ArchiveClassesAtExit → ${archivePath}`)

    const args = [
        ...sharedJvmArgs(),
        // Keep CDS dump diagnostics quiet; training still fails hard if archive missing.
        '-Xlog:cds=error',
        `-XX:ArchiveClassesAtExit=${archivePath}`,
        '-jar',
        jar,
        `--server.port=${TRAIN_PORT}`,
        '--server.address=127.0.0.1',
        `--datawise.config.dir=${configBundleOut}`,
        '--spring.profiles.active=desktop',
        // Do not archive plugin ClassLoader classes — they collide at runtime with plugins/*.jar.
        '--datawise.connectors.load-plugins=false',
        '--management.endpoint.shutdown.enabled=true',
        '--management.endpoints.web.exposure.include=health,shutdown',
        '--server.shutdown=graceful',
    ]

    const proc = spawn(java, args, {
        cwd: backendBundleOut,
        env: {...process.env, JAVA_TOOL_OPTIONS: ''},
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    })

    proc.stdout?.on('data', (chunk) => process.stdout.write(chunk))
    proc.stderr?.on('data', (chunk) => process.stderr.write(chunk))

    await waitForReady(proc)
    log('build-cds', 'backend ready — requesting graceful shutdown for CDS dump')

    const shutdownStatus = await requestShutdown(TRAIN_PORT)
    if (shutdownStatus < 200 || shutdownStatus >= 300) {
        log('build-cds', `actuator shutdown returned ${shutdownStatus}, trying jcmd/signal fallback`)
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
    log('build-cds', `wrote ${archivePath} (${sizeMb.toFixed(1)} MB)`)
}

if (isDirectRun(import.meta.url)) {
    try {
        await buildAppCds()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log('build-cds', `skipped: ${message}`)
        rmSync(archivePath, {force: true})
    }
}
