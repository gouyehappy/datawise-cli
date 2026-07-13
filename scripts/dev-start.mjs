/**
 * 本地开发：后台启动 Spring Boot（18421），前台启动 Electron + Vite。
 * Usage: node scripts/dev-start.mjs
 *        npm run dev:all   (from datawise-frontend)
 */
import {spawn} from 'node:child_process'
import {createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const backendRoot = join(repoRoot, 'datawise-backend')
const frontendRoot = join(repoRoot, 'datawise-frontend')
const configDir = join(repoRoot, 'config')
const devDir = join(frontendRoot, '.dev')
const pidFile = join(devDir, 'backend.pid')
const logFile = join(devDir, 'backend.log')

const ports = JSON.parse(
    readFileSync(join(frontendRoot, 'runtime-ports.json'), 'utf8'),
)

function log(tag, message) {
    console.log(`[${tag}] ${message}`)
}

async function waitForBackend(timeoutMs = 120_000) {
    const url = `http://127.0.0.1:${ports.backend}/api/health`
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
        try {
            const res = await fetch(url, {signal: AbortSignal.timeout(2_000)})
            if (res.ok) return true
        } catch {
            // retry
        }
        await new Promise((r) => setTimeout(r, 400))
    }
    return false
}

async function isBackendReady() {
    try {
        const res = await fetch(`http://127.0.0.1:${ports.backend}/api/health`, {
            signal: AbortSignal.timeout(1_500),
        })
        return res.ok
    } catch {
        return false
    }
}

function compileBackend() {
    return new Promise((resolve, reject) => {
        log('dev-start', 'compiling backend...')
        const child = spawn(
            'mvn',
            ['-pl', 'datawise-server', '-am', 'compile', '-DskipTests'],
            {
                cwd: backendRoot,
                stdio: 'inherit',
                shell: process.platform === 'win32',
                windowsHide: true,
            },
        )
        child.on('exit', (code) => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`backend compile failed (exit ${code ?? 'unknown'})`))
        })
    })
}

function startBackend() {
    mkdirSync(devDir, {recursive: true})
    const logStream = createWriteStream(logFile, {flags: 'a'})
    logStream.write(`\n--- backend dev start ${new Date().toISOString()} ---\n`)

    const jvmArgs = `-Ddatawise.config.dir=${configDir}`
    const child = spawn(
        'mvn',
        ['-pl', 'datawise-server', '-am', 'spring-boot:run', `-Dspring-boot.run.jvmArguments=${jvmArgs}`],
        {
            cwd: backendRoot,
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32',
            windowsHide: true,
        },
    )

    child.stdout?.pipe(logStream)
    child.stderr?.pipe(logStream)
    child.unref()

    writeFileSync(pidFile, String(child.pid), 'utf8')
    log('dev-start', `backend spawning (pid ${child.pid}, log: ${logFile})`)
    return child.pid
}

async function main() {
    if (await isBackendReady()) {
        log('dev-start', `backend already listening on :${ports.backend}`)
        log(
            'dev-start',
            'after backend Java changes run: npm run stop:dev && npm run dev:all',
        )
    } else {
        await compileBackend()
        startBackend()
        log('dev-start', `waiting for backend on :${ports.backend}...`)
        const ready = await waitForBackend()
        if (!ready) {
            console.error(
                `[dev-start] backend did not become ready within 120s. See ${logFile}`,
            )
            process.exit(1)
        }
        log('dev-start', 'backend ready')
    }

    log('dev-start', 'starting frontend (npm run dev:electron)...')
    const frontend = spawn('npm', ['run', 'dev:electron'], {
        cwd: frontendRoot,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: process.env,
    })

    frontend.on('exit', (code) => {
        process.exit(code ?? 0)
    })
}

main().catch((error) => {
    console.error('[dev-start]', error instanceof Error ? error.message : error)
    process.exit(1)
})
