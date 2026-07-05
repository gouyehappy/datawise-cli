/**
 * Assemble desktop bundle: backend JAR, bundled JRE, config + connector plugins.
 *
 * Prerequisites: JAVA_HOME (JDK 17+), Maven, npm deps installed.
 *
 * Output: resources/desktop/{backend,config-bundle}
 */
import {cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execSync} from 'node:child_process'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(frontendRoot, '..')
const backendRoot = join(repoRoot, 'datawise-backend')
const outRoot = join(frontendRoot, 'resources/desktop')
const bundleConfigSrc = join(frontendRoot, 'resources/bundle-config')
const repoConfig = join(repoRoot, 'config')

const SERVER_JAR = join(backendRoot, 'datawise-server/target/datawise-server-0.1.0-SNAPSHOT.jar')

const CONNECTOR_MODULES = [
    'datawise-connectors/datawise-connector-mysql',
    'datawise-connectors/datawise-connector-postgresql',
    'datawise-connectors/datawise-connector-redis',
    'datawise-connectors/datawise-connector-starrocks',
    'datawise-connectors/datawise-connector-doris',
    'datawise-connectors/datawise-connector-mongodb',
    'datawise-connectors/datawise-connector-kafka',
    'datawise-connectors/datawise-connector-sqlserver',
    'datawise-connectors/datawise-connector-oracle',
    'datawise-connectors/datawise-connector-dm',
    'datawise-connectors/datawise-connector-clickhouse',
    'datawise-connectors/datawise-connector-gbase8a',
    'datawise-connectors/datawise-connector-elasticsearch',
    'datawise-connectors/datawise-connector-kylin',
    'datawise-connectors/datawise-connector-trino',
].join(',')

function log(msg) {
    console.log(`[prepare-desktop] ${msg}`)
}

function run(cmd, cwd) {
    log(cmd)
    execSync(cmd, {cwd, stdio: 'inherit', env: process.env})
}

function copyDir(src, dest) {
    mkdirSync(dest, {recursive: true})
    cpSync(src, dest, {recursive: true, force: true})
}

function copyJre(javaHome, dest) {
    const dirs = ['bin', 'lib', 'conf']
    mkdirSync(dest, {recursive: true})
    for (const dir of dirs) {
        const src = join(javaHome, dir)
        if (!existsSync(src)) {
            throw new Error(`JAVA_HOME missing ${dir}/ (${src})`)
        }
        copyDir(src, join(dest, dir))
    }
}

function copyJarFiles(srcDir, destDir, suffix = '.jar') {
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

function assertFile(path, hint) {
    if (!existsSync(path)) {
        throw new Error(`Missing ${path}${hint ? ` — ${hint}` : ''}`)
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function stopDesktopProcesses() {
    try {
        execSync('node scripts/stop-desktop-app.mjs', {cwd: frontendRoot, stdio: 'inherit'})
    } catch {
        // best effort
    }
}

async function removeDirRobust(path) {
    if (!existsSync(path)) return

    const retryable = new Set(['EPERM', 'EBUSY', 'ENOTEMPTY', 'EACCES'])
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            rmSync(path, {recursive: true, force: true, maxRetries: 3, retryDelay: 300})
            return
        } catch (error) {
            const code = error?.code ?? ''
            const message = error instanceof Error ? error.message : String(error)
            if (!retryable.has(code) || attempt === 5) {
                const stale = `${path}.stale-${Date.now()}`
                try {
                    renameSync(path, stale)
                    log(`could not delete ${path}; renamed to ${stale}`)
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
            log(`remove attempt ${attempt}/5 failed (${code}), stopping desktop processes…`)
            stopDesktopProcesses()
            await sleep(800 * attempt)
        }
    }
}

async function main() {
    stopDesktopProcesses()

    // --- build backend ---
    run(`mvn package -pl datawise-server -am -DskipTests`, backendRoot)
    run(`mvn package -pl ${CONNECTOR_MODULES} -am -DskipTests`, backendRoot)
    assertFile(SERVER_JAR, 'run mvn package -pl datawise-server -am')

    // --- assemble output tree ---
    stopDesktopProcesses()
    await removeDirRobust(outRoot)
    const backendOut = join(outRoot, 'backend')
    const configOut = join(outRoot, 'config-bundle')
    mkdirSync(backendOut, {recursive: true})

    cpSync(SERVER_JAR, join(backendOut, 'datawise-server.jar'))
    log(`copied ${SERVER_JAR}`)

    const javaHome = process.env.JAVA_HOME?.trim()
    if (!javaHome) {
        throw new Error('JAVA_HOME is required to bundle a portable JRE')
    }
    copyJre(javaHome, join(backendOut, 'jre'))
    log(`bundled JRE from ${javaHome}`)

    copyDir(bundleConfigSrc, configOut)

    const pluginsOut = join(configOut, 'plugins')
    const driversOut = join(configOut, 'drivers')
    rmSync(join(pluginsOut, '.gitkeep'), {force: true})
    rmSync(join(driversOut, '.gitkeep'), {force: true})

    const pluginCount = copyJarFiles(join(repoConfig, 'plugins'), pluginsOut)
    const driverCount = copyJarFiles(join(repoConfig, 'drivers'), driversOut)
    log(`plugins: ${pluginCount}, drivers: ${driverCount}`)

    for (const sub of ['logs', 'cache/schema', 'scripts', 'ai-checkpoints']) {
        mkdirSync(join(configOut, sub), {recursive: true})
    }

    log('building AppCDS class cache (may take 1–2 min)…')
    try {
        execSync('node scripts/build-app-cds.mjs', {cwd: frontendRoot, stdio: 'inherit', env: process.env})
    } catch {
        log('AppCDS skipped — desktop app will still run without class cache')
    }

    log(`desktop bundle ready at ${outRoot}`)
}

await main()
