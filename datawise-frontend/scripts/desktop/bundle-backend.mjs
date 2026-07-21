/**
 * Build backend JAR, portable JRE, config template, and connector plugins.
 *
 * Prerequisites: JAVA_HOME (JDK 17+), Maven.
 * Output: resources/desktop/{backend,config-bundle}
 *
 * Profiles (see docs/design/RUNTIME_ON_DEMAND_INSTALL.md):
 *   slim — no bundled JRE, no connector JARs (catalog only)
 *   core — jlink JRE + 4 core connectors (default)
 *   full — full JRE + all connectors
 *
 * Maven always skips tests (see maven.mjs).
 */
import {cpSync, existsSync, mkdirSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {
    backendBundleOut,
    bundleConfigSrc,
    configBundleOut,
    CORE_CONNECTOR_JAR_PREFIXES,
    DEFAULT_DESKTOP_PROFILE,
    desktopBundleRoot,
    parseDesktopProfile,
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
import {buildJlinkJre} from './jlink-jre.mjs'
import {generateRuntimeCatalog} from './generate-runtime-catalog.mjs'

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

/**
 * @param {'slim' | 'core' | 'full'} profile
 * @param {string} javaHome
 * @param {string} dest
 */
function bundleJre(profile, javaHome, dest) {
    if (profile === 'slim') {
        log('bundle-backend', 'profile=slim — skipping bundled JRE')
        return
    }
    if (profile === 'core') {
        const jlinkOk = buildJlinkJre(javaHome, dest)
        if (jlinkOk) {
            log('bundle-backend', `bundled jlink JRE (core profile) from ${javaHome}`)
            return
        }
        log('bundle-backend', 'jlink unavailable — falling back to full JRE copy for core profile')
    }
    copyJre(javaHome, dest)
    log('bundle-backend', `bundled full JRE from ${javaHome}`)
}

/**
 * @param {'slim' | 'core' | 'full'} profile
 * @param {string} pluginsSrc
 * @param {string} pluginsOut
 */
function copyPluginsForProfile(profile, pluginsSrc, pluginsOut) {
    if (profile === 'slim') {
        log('bundle-backend', 'profile=slim — no connector JARs in bundle (catalog only)')
        return 0
    }
    if (profile === 'core') {
        return copyJarFiles(pluginsSrc, pluginsOut, '.jar', (name) =>
            CORE_CONNECTOR_JAR_PREFIXES.some((prefix) => name.startsWith(prefix)),
        )
    }
    return copyJarFiles(pluginsSrc, pluginsOut)
}

async function assembleBundle(serverJar, profile) {
    await removePathRobust(desktopBundleRoot, {
        tag: 'bundle-backend',
        onRetry: stopDesktopProcesses,
    })

    mkdirSync(backendBundleOut, {recursive: true})
    cpSync(serverJar, join(backendBundleOut, 'datawise-server.jar'))
    log('bundle-backend', `copied ${serverJar}`)

    const javaHome = process.env.JAVA_HOME?.trim()
    if (profile !== 'slim') {
        if (!javaHome) {
            throw new Error('JAVA_HOME is required to bundle a portable JRE (profile is not slim)')
        }
        bundleJre(profile, javaHome, join(backendBundleOut, 'jre'))
    }

    copyDirSync(bundleConfigSrc, configBundleOut)

    const pluginsOut = join(configBundleOut, 'plugins')
    const driversOut = join(configBundleOut, 'drivers')
    rmSync(join(pluginsOut, '.gitkeep'), {force: true})
    rmSync(join(driversOut, '.gitkeep'), {force: true})

    const pluginsSrc = join(repoConfig, 'plugins')
    await generateRuntimeCatalog({
        pluginsDir: pluginsSrc,
        out: join(configBundleOut, 'runtime-catalog.json'),
    })

    const pluginCount = copyPluginsForProfile(profile, pluginsSrc, pluginsOut)
    const driverCount = copyJarFiles(join(repoConfig, 'drivers'), driversOut)
    log('bundle-backend', `profile=${profile} plugins: ${pluginCount}, drivers: ${driverCount}`)

    for (const sub of ['logs', 'cache/schema', 'scripts', 'ai-checkpoints']) {
        mkdirSync(join(configBundleOut, sub), {recursive: true})
    }
}

async function optionalAppCds(profile) {
    if (profile === 'slim') {
        log('bundle-backend', 'profile=slim — skipping AppCDS (no bundled JRE)')
        return
    }
    log('bundle-backend', 'building AppCDS class cache (may take 1–2 min)…')
    try {
        await buildAppCds()
    } catch {
        log('bundle-backend', 'AppCDS skipped — desktop app will still run without class cache')
    }
}

/**
 * @param {{skipMaven?: boolean, profile?: 'slim' | 'core' | 'full'}} [options]
 */
export async function bundleBackend({skipMaven = false, profile = DEFAULT_DESKTOP_PROFILE} = {}) {
    log('bundle-backend', `desktop packaging profile: ${profile}`)

    if (!skipMaven) {
        await buildDesktopBackendMaven({profile})
    }

    const serverJar = findServerJar(serverTargetDir)
    log('bundle-backend', `using server jar ${serverJar}`)
    await assembleBundle(serverJar, profile)

    await optionalAppCds(profile)

    log('bundle-backend', `desktop bundle ready at ${desktopBundleRoot}`)
}

if (isDirectRun(import.meta.url)) {
    const skipMaven = process.argv.includes('--skip-maven')
    const profile = parseDesktopProfile(process.argv.slice(2))
    await bundleBackend({skipMaven, profile})
}
