/**
 * DataWise 常用命令入口（仓库根目录）。
 *
 *   node scripts/dw.mjs <command>
 *   npm run <command>          # 见根 package.json
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
        desc: 'JCEF 桌面完整打包（当前系统）',
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

function mvn(...args) {
    run(isWin ? 'mvn.cmd' : 'mvn', args, backend)
}

function printHelp() {
    console.log(`
DataWise 常用命令（在仓库根目录执行）

  npm run <命令>

命令：`)
    for (const [id, meta] of Object.entries(COMMANDS)) {
        console.log(`  ${id.padEnd(10)}  ${meta.title}  —  ${meta.desc}`)
    }
    console.log(`
示例：
  npm run clean
  npm run frontend
  npm run backend
  npm run plugins
  npm run all
  npm run dist
  npm run dev
  npm run stop
`)
}

async function main() {
    const cmd = (process.argv[2] || 'help').toLowerCase()

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
            npmFrontend('dist:desktop')
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
            npmFrontend('dist:desktop')
            return
        default:
            console.error(`未知命令: ${cmd}\n`)
            printHelp()
            process.exit(1)
    }
}

await main()
