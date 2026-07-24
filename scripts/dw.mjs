/**
 * DataWise 常用命令入口（仓库根目录）。
 *
 *   node scripts/dw.mjs <command> [-- args…]
 *   npm run <command> [-- args…]
 *
 * 只保留日常会用到的几条；细节脚本仍在 datawise-frontend/package.json。
 */
import {spawnSync} from 'node:child_process'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const frontend = join(root, 'datawise-frontend')
const backend = join(root, 'datawise-backend')
const isWin = process.platform === 'win32'

const COMMANDS = {
    clean: {
        title: '项目清理',
        desc: '清理前端 dist / 桌面产物 / 后端 target-desktop',
    },
    frontend: {
        title: '前端编译打包',
        desc: 'vue-tsc + Vite 构建桌面前端（DATAWISE_DESKTOP）',
    },
    backend: {
        title: '后端编译打包',
        desc: 'Maven 编译 Spring Boot 服务端 JAR（跳过测试）',
    },
    plugins: {
        title: '后端插件',
        desc: '编译连接器插件并输出到 config/plugins/',
    },
    all: {
        title: '全部',
        desc: '清理后依次：后端 + 插件 + 前端 + 桌面打包',
    },
    dist: {
        title: '桌面安装包',
        desc: '当前系统 JCEF 包：zip + 安装程序（Win Setup.exe / Mac DMG / Linux deb）',
    },
    'dist:slim': {
        title: '桌面瘦包',
        desc: '同 dist，profile=slim（无 JRE、无连接器 JAR）',
    },
    'dist:full': {
        title: '桌面全量包',
        desc: '同 dist，profile=full（全连接器 + 完整 JRE）',
    },
    'dist:publish': {
        title: '桌面打包并发布',
        desc: '同 dist，并上传到 GitHub Releases（需 GH_TOKEN）',
    },
    dev: {
        title: '开发联调',
        desc: '直接启动后端 + Vite + JCEF（不预编译打包）',
    },
    stop: {
        title: '停止联调',
        desc: '停止开发联调拉起的进程',
    },
}

function run(command, args, cwd = root) {
    const result = spawnSync(command, args, {
        cwd,
        stdio: 'inherit',
        shell: isWin,
        env: process.env,
    })
    if (result.error) throw result.error
    if (result.status !== 0) {
        process.exit(result.status ?? 1)
    }
}

function npmFrontend(...args) {
    run(isWin ? 'npm.cmd' : 'npm', ['run', ...args], frontend)
}

/** Pass through: npm run dist -- --no-installer */
function npmFrontendWithArgs(script, extraArgs) {
    const args = ['run', script]
    if (extraArgs.length > 0) {
        args.push('--', ...extraArgs)
    }
    run(isWin ? 'npm.cmd' : 'npm', args, frontend)
}

function mvn(...args) {
    run(isWin ? 'mvn.cmd' : 'mvn', args, backend)
}

function printDistHint() {
    console.log(`
产物目录: datawise-frontend/release/
  · DataWiseCLI-{ver}-{os}-{arch}.zip
  · Windows: *-windows-x64-setup.exe   (需 WiX 3.x)
  · macOS:   *-macos-{arm64|x64}.dmg
  · Linux:   *-linux-{x64|arm64}.deb   (需 fakeroot)

常用参数（接在 -- 后面）:
  --no-installer     只打 zip，不打安装程序
  --profile=slim|core|full
  --dir              只组装目录，不打 zip/安装包
  --publish          上传 GitHub Releases（或用 npm run dist:publish）

须在目标操作系统上打包（不可交叉编译）；三端请用 CI: desktop-release.yml
`)
}

function printHelp() {
    console.log(`
DataWise 常用命令（在仓库根目录执行）

  npm run <命令>


命令：`)
    for (const [id, meta] of Object.entries(COMMANDS)) {
        console.log(`  ${id.padEnd(14)}  ${meta.title}  —  ${meta.desc}`)
    }
    console.log(`
示例：
  npm run clean
  npm run frontend
  npm run backend
  npm run plugins
  npm run all
  npm run dist
  npm run dist -- --no-installer
  npm run dist:full
  npm run dist:publish
  npm run dev
  npm run stop
`)
    printDistHint()
}

async function main() {
    const cmd = (process.argv[2] || 'help').toLowerCase()
    const extra = process.argv.slice(3)

    switch (cmd) {
        case 'help':
        case '-h':
        case '--help':
            printHelp()
            return
        case 'clean':
            console.log(`\n▶ ${COMMANDS.clean.title}\n`)
            npmFrontend('clean:desktop')
            return
        case 'frontend':
            console.log(`\n▶ ${COMMANDS.frontend.title}\n`)
            npmFrontend('build:desktop')
            return
        case 'backend':
            console.log(`\n▶ ${COMMANDS.backend.title}\n`)
            npmFrontend('build:backend')
            return
        case 'plugins':
            console.log(`\n▶ ${COMMANDS.plugins.title}\n`)
            // 连接器聚合工程：package 后由 antrun 拷到 config/plugins/
            mvn('-pl', 'datawise-connectors', '-am', 'package', '-DskipTests', '-Dmaven.test.skip=true')
            return
        case 'dist':
            console.log(`\n▶ ${COMMANDS.dist.title}\n`)
            printDistHint()
            npmFrontendWithArgs('dist:desktop', extra)
            return
        case 'dist:slim':
            console.log(`\n▶ ${COMMANDS['dist:slim'].title}\n`)
            printDistHint()
            npmFrontendWithArgs('dist:desktop:slim', extra)
            return
        case 'dist:full':
            console.log(`\n▶ ${COMMANDS['dist:full'].title}\n`)
            printDistHint()
            npmFrontendWithArgs('dist:desktop:full', extra)
            return
        case 'dist:publish':
            console.log(`\n▶ ${COMMANDS['dist:publish'].title}\n`)
            printDistHint()
            npmFrontendWithArgs('dist:desktop:publish', extra)
            return
        case 'dev':
            console.log(`\n▶ ${COMMANDS.dev.title}\n`)
            npmFrontend('dev:all')
            return
        case 'stop':
            console.log(`\n▶ ${COMMANDS.stop.title}\n`)
            npmFrontend('stop:dev')
            return
        case 'all':
            console.log(`\n▶ ${COMMANDS.all.title}\n`)
            npmFrontend('clean:desktop')
            npmFrontend('build:backend')
            mvn('-pl', 'datawise-connectors', '-am', 'package', '-DskipTests', '-Dmaven.test.skip=true')
            npmFrontend('build:desktop')
            npmFrontendWithArgs('dist:desktop', extra)
            return
        default:
            console.error(`未知命令: ${cmd}\n`)
            printHelp()
            process.exit(1)
    }
}

await main()
