/**
 * Remove all desktop build outputs so the next dist:desktop is a full rebuild.
 */
import {existsSync, readdirSync, renameSync, rmSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execSync} from 'node:child_process'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(frontendRoot, '..')
const backendRoot = join(repoRoot, 'datawise-backend')

function log(msg) {
    console.log(`[clean-build] ${msg}`)
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function removePathRobust(path) {
    if (!existsSync(path)) return

    const retryable = new Set(['EPERM', 'EBUSY', 'ENOTEMPTY', 'EACCES'])
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            rmSync(path, {recursive: true, force: true, maxRetries: 3, retryDelay: 300})
            log(`removed ${path}`)
            return
        } catch (error) {
            const code = error?.code ?? ''
            if (!retryable.has(code) || attempt === 5) {
                const stale = `${path}.stale-${Date.now()}`
                try {
                    renameSync(path, stale)
                    log(`could not delete ${path}; renamed to ${stale}`)
                    return
                } catch {
                    log(`WARN: skipped ${path} (${code}) — close DataWise / File Explorer on release/ and delete manually later`)
                    return
                }
            }
            log(`remove attempt ${attempt}/5 failed (${code}), retrying…`)
            try {
                execSync('node scripts/stop-desktop-app.mjs', {cwd: frontendRoot, stdio: 'inherit'})
            } catch {
                // ignore
            }
            await sleep(800 * attempt)
        }
    }
}

async function main() {
    log('stopping desktop processes…')
    try {
        execSync('node scripts/stop-desktop-app.mjs', {cwd: frontendRoot, stdio: 'inherit'})
    } catch {
        // best effort
    }

    const frontendPaths = [
        join(frontendRoot, 'dist'),
        join(frontendRoot, 'dist-electron'),
        join(frontendRoot, 'release'),
        join(frontendRoot, 'resources/desktop'),
        join(frontendRoot, 'node_modules/.vite'),
        join(frontendRoot, '.electron-builder-output'),
    ]

    for (const name of readdirSync(frontendRoot)) {
        if (name.startsWith('release-')) {
            frontendPaths.push(join(frontendRoot, name))
        }
    }

    for (const path of frontendPaths) {
        await removePathRobust(path)
    }

    log('running mvn clean in datawise-backend…')
    execSync('mvn clean -DskipTests', {cwd: backendRoot, stdio: 'inherit', env: process.env})

    log('all build artifacts cleared — run npm run dist:desktop for a fresh package')
}

await main()
