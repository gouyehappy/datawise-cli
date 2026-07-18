/**
 * Build backend JAR, portable JRE, config template, and connector plugins.
 *
 * Prerequisites: JAVA_HOME (JDK 17+), Maven.
 * Output: resources/desktop/{backend,config-bundle}
 *
 * Maven always skips tests (see maven.mjs).
 */
import {cpSync, existsSync, mkdirSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {
    backendBundleOut,
    bundleConfigSrc,
    configBundleOut,
    desktopBundleRoot,
    repoConfig,
    serverTargetDir,
} from './paths.mjs'
import {
    copyDirSync,
    copyJarFiles,
    findServerJar,
    isDirectRun,
    log,
    removePathRobust,
    stopDesktopProcesses,
} from './lib.mjs'
import {buildDesktopBackendMaven} from './maven.mjs'
import {buildAppCds} from './build-cds.mjs'

function copyJre(javaHome, dest) {
    const dirs = ['bin', 'lib', 'conf']
    mkdirSync(dest, {recursive: true})
    for (const dir of dirs) {
        const src = join(javaHome, dir)
        if (!existsSync(src)) {
            throw new Error(`JAVA_HOME missing ${dir}/ (${src})`)
        }
        copyDirSync(src, join(dest, dir))
    }
    if (process.platform === 'darwin') {
        const javaBin = join(dest, 'bin', 'java')
        if (!existsSync(javaBin)) {
            throw new Error(`Bundled macOS JRE missing bin/java under ${dest}`)
        }
        log(
            'bundle-backend',
            `macOS note: JAVA_HOME must match the package arch (Apple Silicon → arm64 JDK 17+). Current: ${javaHome}`,
        )
    }
}

async function assembleBundle(serverJar) {
    await removePathRobust(desktopBundleRoot, {
        tag: 'bundle-backend',
        // Only stop processes if delete hits a lock — packaging purge already stops earlier.
        onRetry: stopDesktopProcesses,
    })

    mkdirSync(backendBundleOut, {recursive: true})
    cpSync(serverJar, join(backendBundleOut, 'datawise-server.jar'))
    log('bundle-backend', `copied ${serverJar}`)

    const javaHome = process.env.JAVA_HOME?.trim()
    if (!javaHome) {
        throw new Error('JAVA_HOME is required to bundle a portable JRE')
    }
    copyJre(javaHome, join(backendBundleOut, 'jre'))
    log('bundle-backend', `bundled JRE from ${javaHome}`)

    copyDirSync(bundleConfigSrc, configBundleOut)

    const pluginsOut = join(configBundleOut, 'plugins')
    const driversOut = join(configBundleOut, 'drivers')
    rmSync(join(pluginsOut, '.gitkeep'), {force: true})
    rmSync(join(driversOut, '.gitkeep'), {force: true})

    const pluginCount = copyJarFiles(join(repoConfig, 'plugins'), pluginsOut)
    const driverCount = copyJarFiles(join(repoConfig, 'drivers'), driversOut)
    log('bundle-backend', `plugins: ${pluginCount}, drivers: ${driverCount}`)

    for (const sub of ['logs', 'cache/schema', 'scripts', 'ai-checkpoints']) {
        mkdirSync(join(configBundleOut, sub), {recursive: true})
    }
}

async function optionalAppCds() {
    log('bundle-backend', 'building AppCDS class cache (may take 1–2 min)…')
    try {
        await buildAppCds()
    } catch {
        log('bundle-backend', 'AppCDS skipped — desktop app will still run without class cache')
    }
}

/**
 * @param {{skipMaven?: boolean}} [options]
 */
export async function bundleBackend({skipMaven = false} = {}) {
    // 1) Maven: server + connectors → JAR / config/plugins (tests skipped)
    //    Process stop happens inside purgeBackendTargets during the Maven step.
    if (!skipMaven) {
        await buildDesktopBackendMaven()
    }

    // 2) Stage resources/desktop (existence check only — Maven already validated boot JAR)
    const serverJar = findServerJar(serverTargetDir)
    log('bundle-backend', `using server jar ${serverJar}`)
    await assembleBundle(serverJar)

    // 3) Optional CDS archive for faster JVM startup
    await optionalAppCds()

    log('bundle-backend', `desktop bundle ready at ${desktopBundleRoot}`)
}

if (isDirectRun(import.meta.url)) {
    const skipMaven = process.argv.includes('--skip-maven')
    await bundleBackend({skipMaven})
}
