/**
 * Build DataWise desktop (JCEF host) for the current OS.
 *
 * Usage:
 *   node scripts/build-desktop.mjs [--profile slim|core|full] [--skip-backend] [--dir] [--publish]
 *     [--no-installer]
 *
 * Output:
 *   datawise-desktop/dist/{windows|linux|macos}/
 *   datawise-frontend/release/DataWiseCLI-{version}-{os}-{arch}.zip
 *   datawise-frontend/release/DataWiseCLI-{version}-windows-x64-setup.exe  (Windows + WiX)
 */
import {spawnSync} from 'node:child_process'
import {
    chmodSync,
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import {arch as osArch, platform as osPlatform} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {
    removePathRobust,
    stopDesktopProcesses,
} from '../../datawise-frontend/scripts/desktop/lib.mjs'

const scriptDir = join(fileURLToPath(import.meta.url), '..')
const desktopRoot = join(scriptDir, '..')
const repoRoot = join(desktopRoot, '..')
const frontendRoot = join(repoRoot, 'datawise-frontend')

function log(msg) {
    console.log(`[dist:desktop] ${msg}`)
}

function readVersion() {
    const pkg = JSON.parse(readFileSync(join(frontendRoot, 'package.json'), 'utf8'))
    return String(pkg.version || '0.0.0')
}

function run(cmd, args, cwd = repoRoot) {
    const result = spawnSync(cmd, args, {
        cwd,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: process.env,
    })
    if (result.status !== 0) {
        process.exit(result.status ?? 1)
    }
}

function parseArgs(argv) {
    const profileArg = argv.find((a) => a.startsWith('--profile='))
    return {
        profile: profileArg ? profileArg.split('=')[1] : 'core',
        skipBackend: argv.includes('--skip-backend'),
        dir: argv.includes('--dir'),
        publish: argv.includes('--publish'),
        // Windows Setup.exe via jpackage (needs WiX). Default on for Windows.
        installer: !argv.includes('--no-installer'),
    }
}

/** @returns {{osKey: string, distDir: string, zipArch: string, mavenProfileHint: string}} */
function resolveTarget() {
    const plat = osPlatform()
    const cpu = osArch()
    const zipArch = cpu === 'arm64' || cpu === 'aarch64' ? 'arm64' : 'x64'
    if (plat === 'win32') {
        return {osKey: 'windows', distDir: 'windows', zipArch: 'x64', mavenProfileHint: 'natives-windows-amd64'}
    }
    if (plat === 'darwin') {
        return {
            osKey: 'macos',
            distDir: 'macos',
            zipArch,
            mavenProfileHint: zipArch === 'arm64' ? 'natives-macosx-arm64' : 'natives-macosx-amd64',
        }
    }
    if (plat === 'linux') {
        return {
            osKey: 'linux',
            distDir: 'linux',
            zipArch,
            mavenProfileHint: zipArch === 'arm64' ? 'natives-linux-arm64' : 'natives-linux-amd64',
        }
    }
    console.error(`[dist:desktop] unsupported platform: ${plat}`)
    process.exit(1)
}

function curlBin() {
    return process.platform === 'win32' ? 'curl.exe' : 'curl'
}

async function bundleBackend(profile) {
    log(`bundling backend (profile=${profile})…`)
    run('node', ['scripts/desktop/bundle-backend.mjs', `--profile=${profile}`], frontendRoot)
}

function buildFrontend() {
    log('building Vue frontend (desktop base ./)…')
    run('npm', ['run', 'build:desktop'], frontendRoot)
}

function buildDesktopHost(version) {
    log('packaging datawise-desktop…')
    run(process.platform === 'win32' ? 'mvn.cmd' : 'mvn', ['-q', 'package'], desktopRoot)
    const jar = join(desktopRoot, 'target', `datawise-desktop-${version}.jar`)
    if (!existsSync(jar)) {
        const alt = join(desktopRoot, 'target', 'datawise-desktop-4.0.1.jar')
        if (!existsSync(alt)) {
            console.error(`[dist:desktop] missing jar: ${jar}`)
            process.exit(1)
        }
        return alt
    }
    return jar
}

function copyDir(src, dest) {
    if (!existsSync(src)) return false
    mkdirSync(dest, {recursive: true})
    cpSync(src, dest, {recursive: true})
    return true
}

function writeWindowsLauncher(out) {
    const launcher = [
        '@echo off',
        'setlocal',
        'cd /d "%~dp0"',
        'if exist "DataWiseCLI.exe" (',
        '  start "" "%~dp0DataWiseCLI.exe" %*',
        '  exit /b %ERRORLEVEL%',
        ')',
        'set DATAWISE_PACKAGED=true',
        'set DATAWISE_INSTALL_ROOT=%CD%',
        'set "JAVA=java"',
        'if exist "backend\\jre\\bin\\java.exe" set "JAVA=backend\\jre\\bin\\java.exe"',
        '"%JAVA%" -cp "datawise-desktop.jar;lib\\*" org.apache.datawise.desktop.DatawiseDesktopApp %*',
        '',
    ].join('\r\n')
    writeFileSync(join(out, 'DataWiseCLI.cmd'), launcher, 'utf8')
}

function writeUnixLauncher(out) {
    const launcher = `#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -x "./DataWiseCLI" ]]; then
  exec ./DataWiseCLI "$@"
fi
if [[ -x "./DataWiseCLI.app/Contents/MacOS/DataWiseCLI" ]]; then
  exec ./DataWiseCLI.app/Contents/MacOS/DataWiseCLI "$@"
fi
export DATAWISE_PACKAGED=true
export DATAWISE_INSTALL_ROOT="$PWD"
JAVA=java
if [[ -x "backend/jre/bin/java" ]]; then
  JAVA="backend/jre/bin/java"
fi
CP="datawise-desktop.jar"
if [[ -d lib ]]; then
  CP="$CP:lib/*"
fi
exec "$JAVA" -cp "$CP" org.apache.datawise.desktop.DatawiseDesktopApp "$@"
`
    const path = join(out, 'DataWiseCLI.sh')
    writeFileSync(path, launcher, 'utf8')
    try {
        chmodSync(path, 0o755)
    } catch {
        // best-effort on Windows checkout
    }
}

async function assembleLayout(version, jarPath, target) {
    const out = join(desktopRoot, 'dist', target.distDir)
    // Running DataWiseCLI.cmd / .exe locks this folder on Windows (EPERM on rm).
    stopDesktopProcesses()
    await removePathRobust(out, {
        tag: 'dist:desktop',
        onRetry: stopDesktopProcesses,
    })
    mkdirSync(out, {recursive: true})

    const libSrc = join(desktopRoot, 'target', 'lib')
    const feDist = join(frontendRoot, 'dist')
    const beSrc = join(frontendRoot, 'resources', 'desktop', 'backend')
    const cfgSrc = join(frontendRoot, 'resources', 'bundle-config')
    const iconsSrc = join(desktopRoot, 'src', 'main', 'resources', 'icons')

    cpSync(jarPath, join(out, 'datawise-desktop.jar'))
    if (existsSync(libSrc)) {
        cpSync(libSrc, join(out, 'lib'), {recursive: true})
    }

    if (!copyDir(feDist, join(out, 'frontend-dist'))) {
        console.error('[dist:desktop] frontend dist missing — run npm run build')
        process.exit(1)
    }
    if (!copyDir(beSrc, join(out, 'backend'))) {
        console.error('[dist:desktop] backend bundle missing — run prepare:desktop')
        process.exit(1)
    }
    copyDir(cfgSrc, join(out, 'config-bundle'))
    copyDir(iconsSrc, join(out, 'icons'))

    wrapWithJpackage(out, version, target)

    if (target.osKey === 'windows') {
        writeWindowsLauncher(out)
    } else {
        writeUnixLauncher(out)
    }

    const runHint =
        target.osKey === 'windows'
            ? 'Run: DataWiseCLI.exe  (preferred)\n  or: DataWiseCLI.cmd'
            : target.osKey === 'macos'
              ? 'Run: ./DataWiseCLI.sh  or open DataWiseCLI.app'
              : 'Run: ./DataWiseCLI.sh  or ./DataWiseCLI'

    const readme = [
        'DataWise CLI (JCEF desktop)',
        `Version: ${version}`,
        `Platform: ${target.osKey}-${target.zipArch}`,
        '',
        runHint,
        '',
        'Requirements: bundled runtime (preferred) or JDK 17+ on PATH.',
        '',
    ].join('\n')
    writeFileSync(join(out, 'README.txt'), readme, 'utf8')

    log(`layout → ${out}`)
    return out
}

/**
 * Produce a native launcher via jpackage when available.
 * Windows: DataWiseCLI.exe · Linux: DataWiseCLI · macOS: DataWiseCLI.app
 */
function wrapWithJpackage(layoutDir, version, target) {
    const jpackage = process.platform === 'win32' ? 'jpackage.exe' : 'jpackage'
    const which = spawnSync(jpackage, ['--version'], {encoding: 'utf8', shell: true})
    if (which.status !== 0) {
        log('jpackage not found — keeping java launcher only')
        return
    }

    const input = join(desktopRoot, 'target', 'jpackage-input')
    const dest = join(desktopRoot, 'target', 'jpackage-out')
    rmSync(input, {recursive: true, force: true})
    rmSync(dest, {recursive: true, force: true})
    mkdirSync(input, {recursive: true})

    cpSync(join(layoutDir, 'datawise-desktop.jar'), join(input, 'datawise-desktop.jar'))
    const libDir = join(layoutDir, 'lib')
    if (existsSync(libDir)) {
        for (const name of readdirSync(libDir)) {
            if (name.endsWith('.jar')) {
                cpSync(join(libDir, name), join(input, name))
            }
        }
    }

    const iconWin = join(layoutDir, 'icons', 'icon.ico')
    const iconPng = join(layoutDir, 'icons', 'icon.png')
    const args = [
        '--type', 'app-image',
        '--name', 'DataWiseCLI',
        '--app-version', version,
        '--copyright', 'DataWise',
        '--description', 'DataWise CLI',
        '--vendor', 'DataWise',
        '--input', input,
        '--main-jar', 'datawise-desktop.jar',
        '--main-class', 'org.apache.datawise.desktop.DatawiseDesktopApp',
        '--dest', dest,
        '--java-options', '-Ddatawise.packaged=true',
        '--java-options', '-Ddatawise.install.root=$ROOTDIR',
        '--java-options', '-Dfile.encoding=UTF-8',
    ]
    if (target.osKey === 'windows' && existsSync(iconWin)) {
        args.push('--icon', iconWin)
    } else if (existsSync(iconPng)) {
        args.push('--icon', iconPng)
    }

    log('running jpackage…')
    const result = spawnSync(jpackage, args, {cwd: desktopRoot, stdio: 'inherit', shell: true})
    if (result.status !== 0) {
        log('jpackage failed — keeping java launcher only')
        return
    }

    const appImage = join(dest, 'DataWiseCLI')
    const macApp = join(dest, 'DataWiseCLI.app')
    let packagedRoot = null
    if (target.osKey === 'macos' && existsSync(macApp)) {
        packagedRoot = macApp
    } else if (existsSync(appImage)) {
        packagedRoot = appImage
    }
    if (!packagedRoot) {
        log('jpackage output missing — keeping java launcher only')
        return
    }

    // Preserve resources next to / inside the native launcher.
    // Windows/Linux app-image root; macOS → Contents (sibling of app/) so installRoot resolves.
    const resourceParent =
        target.osKey === 'macos' ? join(packagedRoot, 'Contents') : packagedRoot
    mkdirSync(resourceParent, {recursive: true})
    for (const dir of ['frontend-dist', 'backend', 'config-bundle', 'icons']) {
        const src = join(layoutDir, dir)
        if (existsSync(src)) {
            cpSync(src, join(resourceParent, dir), {recursive: true})
        }
    }

    for (const name of readdirSync(layoutDir)) {
        rmSync(join(layoutDir, name), {recursive: true, force: true})
    }
    if (target.osKey === 'macos') {
        cpSync(packagedRoot, join(layoutDir, 'DataWiseCLI.app'), {recursive: true})
        // Flat resources also at layout root for DATAWISE_INSTALL_ROOT fallbacks.
        for (const dir of ['frontend-dist', 'backend', 'config-bundle', 'icons']) {
            const src = join(resourceParent, dir)
            if (existsSync(src)) {
                cpSync(src, join(layoutDir, dir), {recursive: true})
            }
        }
    } else {
        for (const name of readdirSync(packagedRoot)) {
            cpSync(join(packagedRoot, name), join(layoutDir, name), {recursive: true})
        }
    }
    log(`jpackage ready (${target.osKey})`)
}

/**
 * Stable upgrade id so newer Setup.exe can replace older installs (Windows).
 * Do not change casually — regenerating breaks in-place upgrades.
 */
const WINDOWS_UPGRADE_UUID = '7f3e9c2a-4b1d-4e8f-9a6c-2d5e8f1b3c4d'

function findWixBinDirs() {
    const dirs = []
    const roots = [
        process.env['WIX'],
        process.env['WIX_HOME'],
        'C:\\Program Files (x86)\\WiX Toolset v3.14\\bin',
        'C:\\Program Files (x86)\\WiX Toolset v3.11\\bin',
        'C:\\Program Files\\WiX Toolset v3.14\\bin',
    ].filter(Boolean)
    for (const root of roots) {
        if (existsSync(join(root, 'candle.exe')) || existsSync(join(root, 'candle'))) {
            dirs.push(root)
        } else if (existsSync(join(root, 'bin', 'candle.exe'))) {
            dirs.push(join(root, 'bin'))
        }
    }
    return dirs
}

function ensureWixOnPath() {
    const which = spawnSync('where.exe', ['candle'], {encoding: 'utf8', shell: true})
    if (which.status === 0) {
        return true
    }
    const bins = findWixBinDirs()
    if (bins.length === 0) {
        return false
    }
    process.env.PATH = `${bins.join(';')};${process.env.PATH || ''}`
    const again = spawnSync('where.exe', ['candle'], {encoding: 'utf8', shell: true})
    return again.status === 0
}

/**
 * Windows Setup.exe installer from the assembled app-image (requires WiX Toolset 3.x).
 * @returns {string|null} path to setup exe
 */
function buildWindowsSetupExe(version, layoutDir, target) {
    if (target.osKey !== 'windows') {
        return null
    }
    if (!existsSync(join(layoutDir, 'DataWiseCLI.exe'))) {
        log('Setup.exe skipped — DataWiseCLI.exe missing (jpackage app-image failed)')
        return null
    }
    if (!ensureWixOnPath()) {
        log('Setup.exe skipped — WiX Toolset 3.x not found (candle.exe).')
        log('  Install: winget install --id WiXToolset.WiXToolset -e')
        log('  Or:      choco install wixtoolset -y')
        log('  Then re-run: npm run dist:desktop')
        return null
    }

    const jpackage = 'jpackage.exe'
    const dest = join(desktopRoot, 'target', 'jpackage-installer')
    rmSync(dest, {recursive: true, force: true})
    mkdirSync(dest, {recursive: true})

    const icon = join(layoutDir, 'icons', 'icon.ico')
    const args = [
        '--type', 'exe',
        '--app-image', layoutDir,
        '--name', 'DataWiseCLI',
        '--app-version', version,
        '--copyright', 'DataWise',
        '--description', 'DataWise CLI',
        '--vendor', 'DataWise',
        '--dest', dest,
        '--win-menu',
        '--win-shortcut',
        '--win-dir-chooser',
        '--win-upgrade-uuid', WINDOWS_UPGRADE_UUID,
    ]
    if (existsSync(icon)) {
        args.push('--icon', icon)
    }

    log('running jpackage --type exe (Setup installer)…')
    const result = spawnSync(jpackage, args, {cwd: desktopRoot, stdio: 'inherit', shell: true})
    if (result.status !== 0) {
        log('jpackage --type exe failed — zip/portable still available')
        return null
    }

    // jpackage names the installer DataWiseCLI-{version}.exe
    const produced = [
        join(dest, `DataWiseCLI-${version}.exe`),
        join(dest, 'DataWiseCLI.exe'),
    ].find((p) => existsSync(p))
    if (!produced) {
        const found = existsSync(dest)
            ? readdirSync(dest).filter((n) => n.toLowerCase().endsWith('.exe'))
            : []
        if (found.length === 1) {
            const p = join(dest, found[0])
            const releaseDir = join(frontendRoot, 'release')
            mkdirSync(releaseDir, {recursive: true})
            const outName = `DataWiseCLI-${version}-${target.osKey}-${target.zipArch}-setup.exe`
            const outPath = join(releaseDir, outName)
            cpSync(p, outPath)
            log(`release setup → ${outPath}`)
            return outPath
        }
        log('Setup.exe output not found in jpackage-installer/')
        return null
    }

    const releaseDir = join(frontendRoot, 'release')
    mkdirSync(releaseDir, {recursive: true})
    const outName = `DataWiseCLI-${version}-${target.osKey}-${target.zipArch}-setup.exe`
    const outPath = join(releaseDir, outName)
    cpSync(produced, outPath)
    log(`release setup → ${outPath}`)
    return outPath
}

function zipRelease(version, layoutDir, target) {
    const releaseDir = join(frontendRoot, 'release')
    mkdirSync(releaseDir, {recursive: true})
    const zipName = `DataWiseCLI-${version}-${target.osKey}-${target.zipArch}.zip`
    const zipPath = join(releaseDir, zipName)

    if (process.platform === 'win32') {
        const ps = [
            'Compress-Archive',
            '-Path', `"${layoutDir}\\*"`,
            '-DestinationPath', `"${zipPath}"`,
            '-Force',
        ].join(' ')
        run('powershell.exe', ['-NoProfile', '-Command', ps], repoRoot)
    } else {
        if (existsSync(zipPath)) {
            rmSync(zipPath, {force: true})
        }
        run('zip', ['-r', zipPath, '.'], layoutDir)
    }

    log(`release zip → ${zipPath}`)
    return zipPath
}

async function publishRelease(version, assetPaths) {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
    if (!token) {
        console.error('[dist:desktop] --publish requires GH_TOKEN or GITHUB_TOKEN')
        process.exit(1)
    }
    const tag = version.startsWith('v') ? version : `v${version}`
    const paths = (Array.isArray(assetPaths) ? assetPaths : [assetPaths]).filter(Boolean)
    if (paths.length === 0) {
        console.error('[dist:desktop] nothing to publish')
        process.exit(1)
    }

    const createUrl = 'https://api.github.com/repos/gouyehappy/datawise-cli/releases'
    const createBody = JSON.stringify({
        tag_name: tag,
        name: `DataWise ${tag}`,
        draft: false,
        prerelease: false,
        generate_release_notes: true,
    })
    const curl = curlBin()

    let releaseId = null
    const list = spawnSync(
        curl,
        ['-sf', '-H', `Authorization: Bearer ${token}`, `${createUrl}/tags/${tag}`],
        {encoding: 'utf8', shell: process.platform === 'win32'},
    )
    if (list.status === 0 && list.stdout) {
        try {
            releaseId = JSON.parse(list.stdout).id
        } catch {
            // create below
        }
    }
    if (!releaseId) {
        const created = spawnSync(
            curl,
            [
                '-sf', '-X', 'POST',
                '-H', `Authorization: Bearer ${token}`,
                '-H', 'Accept: application/vnd.github+json',
                '-H', 'Content-Type: application/json',
                '-d', createBody,
                createUrl,
            ],
            {encoding: 'utf8', shell: process.platform === 'win32'},
        )
        if (created.status !== 0) {
            console.error('[dist:desktop] failed to create release:', created.stderr || created.stdout)
            process.exit(1)
        }
        releaseId = JSON.parse(created.stdout).id
    }

    for (const assetPath of paths) {
        const assetName = assetPath.split(/[/\\]/).pop()
        log(`uploading ${assetName} to GitHub release ${tag}…`)
        const contentType = assetName.endsWith('.exe')
            ? 'application/octet-stream'
            : 'application/zip'
        const uploadUrl = `https://uploads.github.com/repos/gouyehappy/datawise-cli/releases/${releaseId}/assets?name=${assetName}`
        const uploaded = spawnSync(
            curl,
            [
                '-sf', '-X', 'POST',
                '-H', `Authorization: Bearer ${token}`,
                '-H', 'Accept: application/vnd.github+json',
                '-H', `Content-Type: ${contentType}`,
                '--data-binary', `@${assetPath}`,
                uploadUrl,
            ],
            {encoding: 'utf8', shell: process.platform === 'win32'},
        )
        if (uploaded.status !== 0) {
            console.error('[dist:desktop] upload failed:', uploaded.stderr || uploaded.stdout)
            process.exit(1)
        }
    }
    log('published to GitHub Releases')
}

async function main() {
    const target = resolveTarget()
    const opts = parseArgs(process.argv.slice(2))
    const version = readVersion()
    log(`target=${target.osKey}-${target.zipArch} (maven profile ${target.mavenProfileHint})`)

    run('npm', ['run', 'gen:icons'], frontendRoot)

    if (!opts.skipBackend) {
        await bundleBackend(opts.profile)
    }
    buildFrontend()
    const jar = buildDesktopHost(version)
    const layout = await assembleLayout(version, jar, target)

    if (!opts.dir) {
        const zip = zipRelease(version, layout, target)
        const setup = opts.installer ? buildWindowsSetupExe(version, layout, target) : null
        if (opts.publish) {
            await publishRelease(version, [zip, setup])
        }
    } else if (opts.installer) {
        // Unpacked layout still useful for local Setup.exe smoke builds.
        buildWindowsSetupExe(version, layout, target)
    }

    log('done')
}

await main()
