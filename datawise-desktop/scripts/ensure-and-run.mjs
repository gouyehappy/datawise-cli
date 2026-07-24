import {spawn} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(__dirname, '..')
const isWin = process.platform === 'win32'

console.log('[dev:jcef] packaging datawise-desktop…')
const mvn = spawn(isWin ? 'mvn.cmd' : 'mvn', ['-q', 'package'], {
  cwd: desktopRoot,
  stdio: 'inherit',
  shell: isWin,
})

mvn.on('exit', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1)
  }
  const runScript = path.join(desktopRoot, 'scripts', isWin ? 'run-desktop.cmd' : 'run-desktop.sh')
  const child = isWin
    ? spawn('cmd.exe', ['/c', runScript, ...process.argv.slice(2)], {
        cwd: desktopRoot,
        stdio: 'inherit',
      })
    : spawn('bash', [runScript, ...process.argv.slice(2)], {
        cwd: desktopRoot,
        stdio: 'inherit',
      })
  child.on('exit', (c) => process.exit(c ?? 0))
})
