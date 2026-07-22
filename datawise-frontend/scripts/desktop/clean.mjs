/**
 * Clean desktop build outputs.
 *
 *   --release      release/ only (default when called from build.mjs)
 *   --all          frontend artifacts + resources/desktop + target-desktop/
 *   --ide-target   with --all, also purge IDE `target/` under datawise-backend
 */
import {existsSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {
    desktopBundleRoot,
    frontendRoot,
    outputFlagFile,
    releaseDir,
    winUnpackedDir,
} from './paths.mjs'
import {isDirectRun, log, removePathRobust, stopDesktopProcesses} from './lib.mjs'
import {cleanBackendMaven} from './maven.mjs'

async function cleanReleaseDir() {
    // Release wipe may hit locks from a running desktop app.
    stopDesktopProcesses()

    if (!existsSync(winUnpackedDir)) {
        writeFileSync(outputFlagFile, 'release', 'utf8')
        log('clean', 'ready: release/')
        return 'release'
    }

    try {
        await removePathRobust(winUnpackedDir, {
            tag: 'clean',
            onRetry: stopDesktopProcesses,
        })
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

async function cleanAll({includeIdeTarget = false} = {}) {
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
        try {
            await removePathRobust(path, {
                tag: 'clean',
                onRetry: stopDesktopProcesses,
            })
        } catch (error) {
            // On Windows, release artifacts are frequently locked by Explorer previews,
            // anti-virus scanning, or stale Electron handles. Keep --all best-effort:
            // a follow-up cleanDesktop('release') in build.mjs already handles fallback outputs.
            const isReleasePath = path === releaseDir || path.includes(`${join(frontendRoot, 'release-')}`)
            if (isReleasePath) {
                const message = error instanceof Error ? error.message : String(error)
                log('clean', `skip locked release artifact: ${path} (${message})`)
                continue
            }
            throw error
        }
    }

    // cleanBackendMaven → purgeBackendTargets also stops processes once for target-desktop/.
    await cleanBackendMaven({includeIdeTarget})
    log(
        'clean',
        includeIdeTarget
            ? 'all build artifacts cleared (including IDE target/)'
            : 'all packaging artifacts cleared (IDE target/ left intact)',
    )
}

/**
 * @param {'release'|'all'} [mode]
 * @param {{includeIdeTarget?: boolean}} [options]
 */
export async function cleanDesktop(mode = 'release', {includeIdeTarget = false} = {}) {
    if (mode === 'all') {
        await cleanAll({includeIdeTarget})
        return 'release'
    }
    return cleanReleaseDir()
}

if (isDirectRun(import.meta.url)) {
    const mode = process.argv.includes('--all') ? 'all' : 'release'
    const includeIdeTarget = process.argv.includes('--ide-target')
    await cleanDesktop(mode, {includeIdeTarget})
}
