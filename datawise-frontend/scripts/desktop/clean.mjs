/**
 * Clean desktop build outputs.
 *
 *   --release   release/ only (default when called from build.mjs)
 *   --all       frontend artifacts + resources/desktop + mvn clean
 */
import {existsSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {
    backendRoot,
    desktopBundleRoot,
    frontendRoot,
    outputFlagFile,
    releaseDir,
    winUnpackedDir,
} from './paths.mjs'
import {log, removePathRobust, run, stopDesktopProcesses, isDirectRun} from './lib.mjs'

async function cleanReleaseDir() {
    if (!existsSync(winUnpackedDir)) {
        writeFileSync(outputFlagFile, 'release', 'utf8')
        log('clean', 'ready: release/')
        return 'release'
    }

    try {
        await removePathRobust(winUnpackedDir, {tag: 'clean'})
        writeFileSync(outputFlagFile, 'release', 'utf8')
        log('clean', 'ready: release/')
        return 'release'
    } catch {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const altDir = `release-${stamp}`
        mkdirSync(join(frontendRoot, altDir), {recursive: true})
        writeFileSync(outputFlagFile, altDir, 'utf8')
        log('clean', `release/win-unpacked is locked — output will go to ${altDir}/`)
        return altDir
    }
}

async function cleanAll() {
    stopDesktopProcesses()

    const paths = [
        join(frontendRoot, 'dist'),
        join(frontendRoot, 'dist-electron'),
        releaseDir,
        desktopBundleRoot,
        join(frontendRoot, 'node_modules/.vite'),
        outputFlagFile,
    ]

    for (const name of readdirSync(frontendRoot)) {
        if (name.startsWith('release-')) {
            paths.push(join(frontendRoot, name))
        }
    }

    for (const path of paths) {
        await removePathRobust(path, {
            tag: 'clean',
            onRetry: stopDesktopProcesses,
        })
    }

    log('clean', 'running mvn clean in datawise-backend…')
    run('mvn', ['clean', '-DskipTests'], backendRoot)

    log('clean', 'all build artifacts cleared')
}

export async function cleanDesktop(mode = 'release') {
    stopDesktopProcesses()
    if (mode === 'all') {
        await cleanAll()
        return 'release'
    }
    return cleanReleaseDir()
}

if (isDirectRun()) {
    const mode = process.argv.includes('--all') ? 'all' : 'release'
    await cleanDesktop(mode)
}
