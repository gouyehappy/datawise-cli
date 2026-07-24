/**
 * 本地开发：后台启动 Spring Boot（18421），前台启动 JCEF 桌面 + Vite。
 * Usage: node scripts/dev-start.mjs
 *        node scripts/dev-start.mjs --compile   # 启动前强制 mvn compile
 *        npm run dev   (仓库根目录)
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
    const url = `http://127.0.0.1:${ports.dev.backend}/api/health`
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
        const res = await fetch(`http://127.0.0.1:${ports.dev.backend}/api/health`, {
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

async function waitForFrontend(timeoutMs = 60_000) {
    const url = `http://127.0.0.1:${ports.dev.frontend}/`
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

function startViteDevServer() {
    log('dev-start', 'starting Vite (npm run dev)…')
    const child = spawn('npm', ['run', 'dev'], {
        cwd: frontendRoot,
        detached: true,
        stdio: 'ignore',
        shell: process.platform === 'win32',
        env: process.env,
    })
    child.unref()
    return child.pid
}

async function isFrontendReady() {
    try {
        const res = await fetch(`http://127.0.0.1:${ports.dev.frontend}/`, {
            signal: AbortSignal.timeout(1_500),
        })
        return res.ok
    } catch {
        return false
    }
}

async function main() {
    const forceCompile = process.argv.includes('--compile')

    if (await isBackendReady()) {
        log('dev-start', `backend already listening on :${ports.dev.backend}`)
        log(
            'dev-start',
            'after backend Java changes run: npm run stop && npm run dev',
        )
    } else {
        // 默认不预编译，直接 spring-boot:run（已编译则秒启；有改动时 Maven 会按需编译）
        if (forceCompile) {
            await compileBackend()
        } else {
            log('dev-start', 'skip pre-compile — starting spring-boot:run directly')
        }
        startBackend()
        log('dev-start', `waiting for backend on :${ports.dev.backend}...`)
        const ready = await waitForBackend()
        if (!ready) {
            console.error(
                `[dev-start] backend did not become ready within 120s. See ${logFile}`,
            )
            process.exit(1)
        }
        log('dev-start', 'backend ready')
    }

    if (!(await isFrontendReady())) {
        startViteDevServer()
        log('dev-start', `waiting for Vite on :${ports.dev.frontend}…`)
        const viteReady = await waitForFrontend()
        if (!viteReady) {
            console.error(`[dev-start] Vite did not become ready within 60s`)
            process.exit(1)
        }
        log('dev-start', 'Vite ready')
    } else {
        log('dev-start', `Vite already listening on :${ports.dev.frontend}`)
    }

    log('dev-start', 'starting desktop host (npm run dev:jcef)…')
    const frontend = spawn('npm', ['run', 'dev:jcef'], {
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
