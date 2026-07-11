/**
 * Shared helpers for desktop packaging scripts.
 */
import {execSync, spawnSync} from 'node:child_process'
import {cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {frontendRoot} from './paths.mjs'

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'ENOTEMPTY', 'EACCES'])

export function log(tag, msg) {
    console.log(`[${tag}] ${msg}`)
}

export function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
}

export function isDirectRun() {
    const entry = process.argv[1]
    if (!entry) return false
    return fileURLToPath(import.meta.url) === resolve(entry)
}

export function run(cmd, args, cwd = frontendRoot) {
    log('desktop', `${cmd} ${args.join(' ')}`.trim())
    const result = spawnSync(cmd, args, {
        cwd,
        stdio: 'inherit',
        env: process.env,
        shell: process.platform === 'win32',
    })
    if (result.status !== 0) {
        process.exit(result.status ?? 1)
    }
}

export function runNpm(script) {
    run('npm', ['run', script], frontendRoot)
}

export function runMaven(cwd, goals, projectList) {
    const args = [...goals]
    if (projectList) {
        args.push('-pl', projectList, '-am')
    }
    args.push(
        '-Dmaven.test.skip=true',
        '-Dmaven.compiler.useIncrementalCompilation=false',
    )
    run('mvn', args, cwd)
}

export function stopDesktopProcesses() {
    if (process.platform === 'win32') {
        killImage('DataWiseCLI.exe')
        killImage('DataWise CLI.exe')
        killImage('electron.exe')

        const wmicFilters = [
            "CommandLine like '%datawise-server%'",
            "CommandLine like '%resources\\\\desktop%'",
            "CommandLine like '%resources/desktop%'",
        ]
        for (const filter of wmicFilters) {
            try {
                const raw = execSync(
                    `wmic process where "${filter}" get ProcessId`,
                    {encoding: 'utf8', windowsHide: true},
                )
                for (const line of raw.split(/\r?\n/)) {
                    const pid = line.trim()
                    if (/^\d+$/.test(pid)) {
                        killTask(`taskkill /F /PID ${pid} /T`)
                    }
                }
            } catch {
                // wmic unavailable or no matches
            }
        }
    } else {
        killTask('pkill -f "datawise-server"')
        killTask('pkill -f "DataWise CLI"')
    }
    log('stop-desktop', 'stale desktop/backend processes stopped (if any)')
}

function killImage(imageName) {
    killTask(`taskkill /F /IM "${imageName}" /T`)
}

function killTask(cmd) {
    try {
        execSync(cmd, {stdio: 'ignore', windowsHide: true})
    } catch {
        // process may already be gone
    }
}

export async function removePathRobust(path, {onRetry, tag = 'desktop'} = {}) {
    if (!existsSync(path)) return

    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            rmSync(path, {recursive: true, force: true, maxRetries: 3, retryDelay: 300})
            log(tag, `removed ${path}`)
            return
        } catch (error) {
            const code = error?.code ?? ''
            const message = error instanceof Error ? error.message : String(error)
            if (!RETRYABLE.has(code) || attempt === 5) {
                const stale = `${path}.stale-${Date.now()}`
                try {
                    renameSync(path, stale)
                    log(tag, `could not delete ${path}; renamed to ${stale}`)
                    return
                } catch {
                    throw new Error(
                        `Cannot remove ${path} (${code || message}). ` +
                            'Close DataWise CLI, dev:electron, and any File Explorer window on this folder, ' +
                            'then run: npm run stop:desktop',
                        {cause: error},
                    )
                }
            }
            log(tag, `remove attempt ${attempt}/5 failed (${code})`)
            onRetry?.()
            await sleep(800 * attempt)
        }
    }
}

export function copyDirSync(src, dest) {
    mkdirSync(dest, {recursive: true})
    cpSync(src, dest, {recursive: true, force: true})
}

export function copyJarFiles(srcDir, destDir, suffix = '.jar') {
    if (!existsSync(srcDir)) return 0
    mkdirSync(destDir, {recursive: true})
    let count = 0
    for (const name of readdirSync(srcDir)) {
        if (!name.endsWith(suffix)) continue
        cpSync(join(srcDir, name), join(destDir, name))
        count++
    }
    return count
}

export function resolveServerJar(serverTargetDir) {
    if (!existsSync(serverTargetDir)) {
        throw new Error(`Missing ${serverTargetDir} — run Maven build for datawise-server first`)
    }
    const candidates = readdirSync(serverTargetDir)
        .filter((name) =>
            name.startsWith('datawise-server-')
            && name.endsWith('.jar')
            && !name.endsWith('.jar.original'),
        )
        .sort()
    if (!candidates.length) {
        throw new Error(`No datawise-server-*.jar in ${serverTargetDir}`)
    }
    return join(serverTargetDir, candidates[candidates.length - 1])
}

if (isDirectRun() && process.argv.includes('--stop-processes')) {
    stopDesktopProcesses()
}
