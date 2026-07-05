/**
 * 清理 electron-builder 输出目录；若 release/ 被占用则改用带时间戳的新目录。
 */
import {existsSync, mkdirSync, renameSync, rmSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execSync} from 'node:child_process'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = join(frontendRoot, 'release')
const winUnpacked = join(releaseDir, 'win-unpacked')
const outputFlagFile = join(frontendRoot, '.electron-builder-output')

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function tryRemove(path) {
    rmSync(path, {recursive: true, force: true, maxRetries: 3, retryDelay: 300})
}

async function cleanWinUnpacked() {
    if (!existsSync(winUnpacked)) return true

    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            tryRemove(winUnpacked)
            return true
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.warn(`[clean-release] attempt ${attempt}/5 failed: ${message}`)
            if (attempt < 5) {
                try {
                    execSync('node scripts/stop-desktop-app.mjs', {
                        cwd: frontendRoot,
                        stdio: 'inherit',
                        windowsHide: true,
                    })
                } catch {
                    // ignore
                }
                await sleep(800 * attempt)
            }
        }
    }
    return false
}

async function main() {
    execSync('node scripts/stop-desktop-app.mjs', {cwd: frontendRoot, stdio: 'inherit'})

    const cleaned = await cleanWinUnpacked()
    if (cleaned) {
        writeFileSync(outputFlagFile, 'release', 'utf8')
        console.log('[clean-release] ready: release/')
        return
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const altDir = `release-${stamp}`
    const altPath = join(frontendRoot, altDir)
    mkdirSync(altPath, {recursive: true})
    writeFileSync(outputFlagFile, altDir, 'utf8')
    console.warn(
        `[clean-release] release/win-unpacked is locked — output will go to ${altDir}/`,
    )
    console.warn('[clean-release] close any running DataWise CLI window and retry for release/')
}

await main()
