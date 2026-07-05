/**
 * 运行 electron-builder，输出目录由 clean-release.mjs 写入 .electron-builder-output。
 */
import {existsSync, readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const flagFile = join(frontendRoot, '.electron-builder-output')
const outputDir = existsSync(flagFile) ? readFileSync(flagFile, 'utf8').trim() : 'release'

const builderBin = process.platform === 'win32'
    ? join(frontendRoot, 'node_modules', '.bin', 'electron-builder.cmd')
    : join(frontendRoot, 'node_modules', '.bin', 'electron-builder')

const args = [
    `--config.directories.output=${outputDir}`,
    ...process.argv.slice(2),
]

console.log(`[electron-builder] output -> ${outputDir}/`)

const result = spawnSync(builderBin, args, {
    cwd: frontendRoot,
    stdio: 'inherit',
    env: {
        ...process.env,
        CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    },
    shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
