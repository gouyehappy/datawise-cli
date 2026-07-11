/**
 * Build backend JAR, bundle portable JRE, config template, and connector plugins.
 *
 * Prerequisites: JAVA_HOME (JDK 17+), Maven.
 * Output: resources/desktop/{backend,config-bundle}
 */
import {cpSync, existsSync, mkdirSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {
    backendBundleOut,
    backendRoot,
    bundleConfigSrc,
    configBundleOut,
    CONNECTOR_MODULES,
    desktopBundleRoot,
    repoConfig,
    serverTargetDir,
} from './paths.mjs'
import {
    copyDirSync,
    copyJarFiles,
    isDirectRun,
    log,
    removePathRobust,
    resolveServerJar,
    runMaven,
    stopDesktopProcesses,
} from './lib.mjs'
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
}

export async function bundleBackend({skipMaven = false} = {}) {
    stopDesktopProcesses()

    if (!skipMaven) {
        runMaven(backendRoot, ['clean', 'install'], 'datawise-server')
        runMaven(backendRoot, ['package'], CONNECTOR_MODULES.join(','))
    }

    const serverJar = resolveServerJar(serverTargetDir)
    log('bundle-backend', `using server jar ${serverJar}`)

    stopDesktopProcesses()
    await removePathRobust(desktopBundleRoot, {
        tag: 'bundle-backend',
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

    log('bundle-backend', 'building AppCDS class cache (may take 1–2 min)…')
    try {
        await buildAppCds()
    } catch {
        log('bundle-backend', 'AppCDS skipped — desktop app will still run without class cache')
    }

    log('bundle-backend', `desktop bundle ready at ${desktopBundleRoot}`)
}

if (isDirectRun()) {
    const skipMaven = process.argv.includes('--skip-maven')
    await bundleBackend({skipMaven})
}
