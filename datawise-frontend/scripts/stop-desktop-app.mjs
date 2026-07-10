/**
 * 打包前结束可能占用 release/app.asar 的 DataWise 桌面进程与内嵌后端 JVM。
 */
import {execSync} from 'node:child_process'

function run(cmd) {
    try {
        execSync(cmd, {stdio: 'ignore', windowsHide: true})
    } catch {
        // process may already be gone
    }
}

function killImage(imageName) {
    run(`taskkill /F /IM "${imageName}" /T`)
}

if (process.platform === 'win32') {
    killImage('DataWiseCLI.exe')
    killImage('DataWise CLI.exe')
    killImage('electron.exe')

    const wmicFilters = [
        "CommandLine like '%datawise-server%'",
        "CommandLine like '%resources\\\\desktop%'",
        "CommandLine like '%resources/desktop%'",
    ]
    for (const filter of wmicFilters) {
        try {
            const raw = execSync(
                `wmic process where "${filter}" get ProcessId`,
                {encoding: 'utf8', windowsHide: true},
            )
            for (const line of raw.split(/\r?\n/)) {
                const pid = line.trim()
                if (/^\d+$/.test(pid)) {
                    run(`taskkill /F /PID ${pid} /T`)
                }
            }
        } catch {
            // wmic unavailable or no matches
        }
    }
} else {
    run('pkill -f "datawise-server"')
    run('pkill -f "DataWise CLI"')
}

console.log('[stop-desktop] stale desktop/backend processes stopped (if any)')
