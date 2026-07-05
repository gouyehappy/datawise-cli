/**
 * 确保 Electron 二进制已下载（postinstall 失败时 path.txt / dist/ 会缺失）。
 * 默认走 npmmirror，可通过 ELECTRON_MIRROR 覆盖。
 */
import {execSync} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const electronDir = join(root, 'node_modules', 'electron')
const pathFile = join(electronDir, 'path.txt')
const installScript = join(electronDir, 'install.js')

function electronReady() {
    if (!existsSync(pathFile)) return false
    const name = readFileSync(pathFile, 'utf8').trim()
    return Boolean(name) && existsSync(join(electronDir, 'dist', name))
}

if (!existsSync(installScript)) {
    console.log('[install-electron] skip: electron not in node_modules')
    process.exit(0)
}

if (electronReady()) {
    console.log('[install-electron] ok:', readFileSync(pathFile, 'utf8').trim())
    process.exit(0)
}

const mirror = process.env.ELECTRON_MIRROR?.trim() || 'https://npmmirror.com/mirrors/electron/'
console.log(`[install-electron] downloading binary via ${mirror}`)

try {
    execSync(`node "${installScript}"`, {
        cwd: electronDir,
        stdio: 'inherit',
        env: {
            ...process.env,
            ELECTRON_MIRROR: mirror,
        },
        windowsHide: true,
    })
} catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[install-electron] failed:', message)
    console.error('  retry: npm run setup:electron')
    process.exit(1)
}

if (!electronReady()) {
    console.error('[install-electron] install.js finished but binary still missing')
    process.exit(1)
}

console.log('[install-electron] ok:', readFileSync(pathFile, 'utf8').trim())
