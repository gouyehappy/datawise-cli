/**
 * Maven helpers for desktop / backend packaging.
 *
 * Goals:
 * - Always skip tests
 * - Build into `target-desktop/` so Cursor/VS Code Java LS (which writes `target/`)
 *   cannot corrupt .class files / boot JARs mid-compile on Windows
 * - Prefer filesystem purge over maven-clean (less EPERM on Windows)
 * - Validate the Spring Boot server JAR before continuing
 */
import {execSync} from 'node:child_process'
import {existsSync, readdirSync} from 'node:fs'
import {join} from 'node:path'
import {
    backendRoot,
    backendModulesForProfile,
    DEFAULT_DESKTOP_PROFILE,
    DESKTOP_MAVEN_BUILD_DIR,
    serverTargetDir,
} from './paths.mjs'
import {
    isDirectRun,
    log,
    removePathRobust,
    resolveServerJar,
    run,
    sleep,
    stopDesktopProcesses,
} from './lib.mjs'

/** Skip compiling and running tests for every desktop Maven invocation. */
export const MAVEN_SKIP_TEST_ARGS = [
    '-Dmaven.test.skip=true',
    '-DskipTests',
]

/** Isolate packaging outputs from IDE default target/. */
export const MAVEN_DESKTOP_DIR_ARGS = [
    `-Ddatawise.build.dir=${DESKTOP_MAVEN_BUILD_DIR}`,
]

/** Stability flags for Windows packaging builds. */
export const MAVEN_STABLE_ARGS = [
    // Disable incremental javac — partial class dirs cause "class file for X not found".
    '-Dmaven.compiler.useIncrementalCompilation=false',
    // Single-threaded reactor: fewer half-written outputs.
    '-T',
    '1',
]

const SKIP_DIR_NAMES = new Set(['.git', 'node_modules', '.idea', '.vscode', 'release', 'dist'])

/**
 * Collect Maven build-output directories under datawise-backend.
 * @param {string} [root]
 * @param {string[]} [names] directory basenames to collect
 */
export function collectBackendTargetDirs(
    root = backendRoot,
    names = [DESKTOP_MAVEN_BUILD_DIR],
) {
    const wanted = new Set(names)
    const results = []
    const walk = (dir, depth) => {
        if (depth > 8) return
        let entries
        try {
            entries = readdirSync(dir, {withFileTypes: true})
        } catch {
            return
        }
        for (const ent of entries) {
            if (!ent.isDirectory()) continue
            if (SKIP_DIR_NAMES.has(ent.name)) continue
            const full = join(dir, ent.name)
            if (wanted.has(ent.name)) {
                results.push(full)
                continue
            }
            walk(full, depth + 1)
        }
    }
    walk(root, 0)
    return results
}

function killPid(pid) {
    try {
        execSync(`taskkill /F /PID ${pid} /T`, {stdio: 'ignore', windowsHide: true})
        return true
    } catch {
        return false
    }
}

/**
 * Opt-in stop of Cursor/VS Code Java language servers.
 * Packaging already writes to `target-desktop/` (not IDE `target/`), so this is off by default.
 * Set DATAWISE_KILL_JAVA_LS=1 only if you still see IDE-related file locks.
 */
export function stopJavaIdeBuilders() {
    if (process.platform !== 'win32') {
        return
    }
    if (process.env.DATAWISE_KILL_JAVA_LS !== '1') {
        return
    }

    const patterns = ['jdt.ls', 'jdt_ws', 'redhat.java', 'org.eclipse.equinox.launcher']
    const pids = new Set()

    try {
        // Use -EncodedCommand so nested quotes in -Filter are not eaten by cmd/PowerShell.
        const ps = [
            "Get-CimInstance Win32_Process -Filter \"Name = 'java.exe'\"",
            '| Where-Object {',
            patterns.map((p) => `$_.CommandLine -like '*${p}*'`).join(' -or '),
            '} | Select-Object -ExpandProperty ProcessId',
        ].join(' ')
        const encoded = Buffer.from(ps, 'utf16le').toString('base64')
        const raw = execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, {
            encoding: 'utf8',
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        for (const line of raw.split(/\r?\n/)) {
            const pid = line.trim()
            if (/^\d+$/.test(pid)) pids.add(pid)
        }
    } catch {
        // fall through to wmic
    }

    if (pids.size === 0) {
        for (const pattern of patterns) {
            try {
                const raw = execSync(
                    `wmic process where "CommandLine like '%${pattern}%'" get ProcessId`,
                    {encoding: 'utf8', windowsHide: true},
                )
                for (const line of raw.split(/\r?\n/)) {
                    const pid = line.trim()
                    if (/^\d+$/.test(pid)) pids.add(pid)
                }
            } catch {
                // no matches / wmic unavailable
            }
        }
    }

    let killed = 0
    for (const pid of pids) {
        if (killPid(pid)) killed += 1
    }
    if (killed > 0) {
        log('maven', `stopped ${killed} Java IDE builder process(es) (DATAWISE_KILL_JAVA_LS=1)`)
    }
}

/**
 * Free locks, then delete packaging output dirs (`target-desktop/`).
 * Does not delete IDE `target/` unless `includeIdeTarget` is set.
 * This is the only place in the packaging pipeline that stops desktop processes by default.
 */
export async function purgeBackendTargets({includeIdeTarget = false} = {}) {
    stopDesktopProcesses()
    stopJavaIdeBuilders()
    await sleep(400)

    const names = includeIdeTarget
        ? [DESKTOP_MAVEN_BUILD_DIR, 'target']
        : [DESKTOP_MAVEN_BUILD_DIR]
    const targets = collectBackendTargetDirs(backendRoot, names)
    log(
        'maven',
        `purging ${targets.length} ${names.join('|')}/ directories under datawise-backend…`,
    )
    for (const target of targets) {
        await removePathRobust(target, {
            tag: 'maven',
            onRetry: () => {
                stopDesktopProcesses()
                stopJavaIdeBuilders()
            },
        })
    }
}

/**
 * @param {object} options
 * @param {string} [options.cwd]
 * @param {string[]} options.goals
 * @param {string|string[]|null} [options.modules] - Maven -pl list; null = whole reactor
 * @param {boolean} [options.alsoMake] - pass -am with -pl
 * @param {string[]} [options.extraArgs]
 */
export function runMaven({
    cwd = backendRoot,
    goals,
    modules = null,
    alsoMake = true,
    extraArgs = [],
} = {}) {
    if (!Array.isArray(goals) || goals.length === 0) {
        throw new Error('runMaven requires goals')
    }

    const args = [...goals]
    if (modules != null) {
        const list = Array.isArray(modules) ? modules.filter(Boolean).join(',') : String(modules)
        if (list) {
            args.push('-pl', list)
            if (alsoMake) args.push('-am')
        }
    }

    args.push(
        ...MAVEN_SKIP_TEST_ARGS,
        ...MAVEN_DESKTOP_DIR_ARGS,
        ...MAVEN_STABLE_ARGS,
        ...extraArgs,
    )

    log('maven', `mvn ${args.join(' ')}`)
    run('mvn', args, cwd)
}

function assertSqlFlowStatementClass() {
    const statementClass = join(
        backendRoot,
        'datawise-sqlflow',
        DESKTOP_MAVEN_BUILD_DIR,
        'classes/org/apache/datawise/sqlflow/tree/statement/Statement.class',
    )
    if (!existsSync(statementClass)) {
        throw new Error(
            `Missing ${statementClass} after Maven build. ` +
                'Re-run: npm run build:backend',
        )
    }
    log('maven', 'validated sqlflow Statement.class')
}

/**
 * Build server + desktop connector plugins into target-desktop/.
 * @param {{profile?: 'slim' | 'core' | 'full'}} [options]
 */
export async function buildDesktopBackendMaven({profile = DEFAULT_DESKTOP_PROFILE} = {}) {
    const modules = backendModulesForProfile(profile)
    log(
        'maven',
        `building profile=${profile} modules=${modules.length} → ${DESKTOP_MAVEN_BUILD_DIR}/ (tests skipped)…`,
    )
    await purgeBackendTargets({includeIdeTarget: false})

    runMaven({
        goals: ['install'],
        modules,
        alsoMake: true,
    })

    const jar = resolveServerJar(serverTargetDir)
    assertSqlFlowStatementClass()
    log('maven', `backend build OK → ${jar}`)
    return jar
}

/** Clean packaging outputs (`target-desktop/`). Pass `includeIdeTarget: true` to also wipe IDE `target/`. */
export async function cleanBackendMaven({includeIdeTarget = false} = {}) {
    log('maven', 'cleaning datawise-backend packaging outputs…')
    await purgeBackendTargets({includeIdeTarget})
    log('maven', 'backend build outputs cleared')
}

if (isDirectRun(import.meta.url)) {
    await buildDesktopBackendMaven()
}
