/**
 * 下载 / 校验 Electron 可用的 node-pty 原生二进制（Windows 需从 GitHub 拉 prebuild）。
 * postinstall 失败时不阻断 npm install；打包前请确保本脚本输出 ok。
 */
import {execSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {existsSync, readdirSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PTY_DIR = join(root, 'node_modules', 'node-pty')

function electronVersion() {
    try {
        return require(join(root, 'node_modules/electron/package.json')).version
    } catch {
        return null
    }
}

function resolvePtyNativeBinary() {
    const releasePath = join(PTY_DIR, 'build', 'Release', 'pty.node')
    if (existsSync(releasePath)) {
        return releasePath
    }

    const prebuildDir = join(PTY_DIR, 'prebuilds', `${process.platform}-${process.arch}`)
    if (existsSync(prebuildDir)) {
        const match = readdirSync(prebuildDir).find(
            (name) => name.startsWith('electron.') && name.endsWith('.node'),
        )
        if (match) return join(prebuildDir, match)
    }

    return null
}

function runPrebuildInstall(electronVersion) {
    const env = {
        ...process.env,
        npm_config_runtime: 'electron',
        npm_config_target: electronVersion,
        npm_config_disturl: 'https://electronjs.org/headers',
        npm_config_arch: process.arch,
        npm_config_build_from_source: 'false',
    }
    execSync('npx prebuild-install --verbose', {
        cwd: PTY_DIR,
        stdio: 'inherit',
        env,
        windowsHide: true,
    })
}

const version = electronVersion()
if (!version) {
    console.log('[install-electron-pty] skip: electron not installed')
    process.exit(0)
}

if (!existsSync(PTY_DIR)) {
    console.log('[install-electron-pty] skip: node-pty not installed')
    process.exit(0)
}

const existing = resolvePtyNativeBinary()
if (existing) {
    console.log('[install-electron-pty] ok:', existing)
    process.exit(0)
}

console.log(`[install-electron-pty] downloading prebuild for electron@${version} (${process.platform}-${process.arch})…`)
try {
    runPrebuildInstall(version)
    const path = resolvePtyNativeBinary()
    if (!path) {
        throw new Error('electron prebuild not found after prebuild-install')
    }
    console.log('[install-electron-pty] ok:', path)
} catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const missingAsset = message.includes('404') || message.includes('No prebuilt binaries')
    console.warn(
        missingAsset
            ? '[install-electron-pty] 当前 Electron 版本无 GitHub prebuild（release 未发布该 ABI，非网络问题）。'
            + ' 请使用 package.json 中的 electron 29.4.6，或安装 Python + VS Build Tools 后 npm rebuild node-pty。\n'
            : '[install-electron-pty] 下载失败，请检查网络后重试: npm run rebuild:electron-pty\n',
    )
    console.warn(`  (${message})`)
    process.exit(0)
}
