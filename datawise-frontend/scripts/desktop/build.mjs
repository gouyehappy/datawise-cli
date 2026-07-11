/**
 * Build DataWise desktop executable (Windows installer + portable).
 *
 * Usage:
 *   node scripts/desktop/build.mjs [--clean] [--skip-backend] [--dir]
 *
 * npm scripts:
 *   dist:desktop        full build (backend + electron + NSIS/portable)
 *   dist:desktop:clean  full rebuild from scratch
 *   pack:desktop        unpacked win-unpacked dir for quick testing
 */
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {frontendRoot, outputFlagFile} from './paths.mjs'
import {log, runNpm, stopDesktopProcesses} from './lib.mjs'
import {bundleBackend} from './bundle-backend.mjs'
import {cleanDesktop} from './clean.mjs'

function parseArgs(argv) {
    return {
        clean: argv.includes('--clean'),
        skipBackend: argv.includes('--skip-backend'),
        dir: argv.includes('--dir'),
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

    stopDesktopProcesses()

    if (opts.clean) {
        await cleanDesktop('all')
    }

    if (!opts.skipBackend) {
        await bundleBackend()
    }

    await cleanDesktop('release')
    runNpm('build:electron')

    const builderArgs = opts.dir ? ['--dir'] : ['--win']
    runElectronBuilder(builderArgs)

    log('build-desktop', 'done')
}

await main()
