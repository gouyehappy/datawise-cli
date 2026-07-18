/**
 * Build DataWise desktop executable (Windows / macOS / Linux).
 *
 * Usage:
 *   node scripts/desktop/build.mjs [--clean] [--skip-backend] [--dir]
 *     [--win] [--mac] [--linux] [--arm64] [--x64] [--ide-target]
 *
 * npm scripts:
 *   dist:desktop           host platform (Windows → NSIS/portable; macOS → DMG/zip arm64)
 *   dist:desktop:mac       macOS Apple Silicon DMG + zip (must run on macOS)
 *   dist:desktop:linux     Linux AppImage (must run on Linux)
 *   pack:desktop           unpacked dir for quick testing
 */
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {frontendRoot, outputFlagFile} from './paths.mjs'
import {log, runNpm} from './lib.mjs'
import {bundleBackend} from './bundle-backend.mjs'
import {cleanDesktop} from './clean.mjs'
import {describeDesktopTarget, resolveElectronBuilderArgs} from './platform.mjs'

function parseArgs(argv) {
    return {
        clean: argv.includes('--clean'),
        skipBackend: argv.includes('--skip-backend'),
        dir: argv.includes('--dir'),
        includeIdeTarget: argv.includes('--ide-target'),
        win: argv.includes('--win'),
        mac: argv.includes('--mac'),
        linux: argv.includes('--linux'),
        arm64: argv.includes('--arm64'),
        x64: argv.includes('--x64'),
    }
}

function runElectronBuilder(extraArgs) {
    const outputDir = existsSync(outputFlagFile)
        ? readFileSync(outputFlagFile, 'utf8').trim()
        : 'release'

    const builderBin = process.platform === 'win32'
        ? join(frontendRoot, 'node_modules', '.bin', 'electron-builder.cmd')
        : join(frontendRoot, 'node_modules', '.bin', 'electron-builder')

    const args = [
        `--config.directories.output=${outputDir}`,
        ...extraArgs,
    ]

    log('build-desktop', `electron-builder output → ${outputDir}/`)
    log('build-desktop', `target: ${describeDesktopTarget(extraArgs)}`)
    const result = spawnSync(builderBin, args, {
        cwd: frontendRoot,
        stdio: 'inherit',
        env: {
            ...process.env,
            CSC_IDENTITY_AUTO_DISCOVERY: 'false',
        },
        shell: process.platform === 'win32',
    })
    if (result.status !== 0) {
        process.exit(result.status ?? 1)
    }
}

async function main() {
    const opts = parseArgs(process.argv.slice(2))

    if (opts.clean) {
        await cleanDesktop('all', {includeIdeTarget: opts.includeIdeTarget})
    }

    if (!opts.skipBackend) {
        await bundleBackend()
    }

    await cleanDesktop('release')
    runNpm('build:electron')

    let builderArgs
    try {
        builderArgs = resolveElectronBuilderArgs(opts)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[build-desktop] ${message}`)
        process.exit(1)
    }

    runElectronBuilder(builderArgs)
    log('build-desktop', 'done')
}

await main()
