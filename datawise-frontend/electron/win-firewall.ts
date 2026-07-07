import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
import {app} from 'electron'

export const WINDOWS_FIREWALL_RULE_NAME = 'DataWise CLI Backend'

/** 安装版/便携版：若已有管理员权限则预置 java.exe 入站放行，避免首次运行弹窗 */
export function ensureWindowsFirewallRule(javaExe: string): void {
    if (process.platform !== 'win32' || !app.isPackaged) return
    if (!existsSync(javaExe)) return

    const existing = spawn('netsh', [
        'advfirewall', 'firewall', 'show', 'rule',
        `name=${WINDOWS_FIREWALL_RULE_NAME}`,
    ], {windowsHide: true})

    let stdout = ''
    existing.stdout?.setEncoding('utf8')
    existing.stdout?.on('data', (chunk: string) => {
        stdout += chunk
    })

    existing.on('error', () => undefined)
    existing.on('close', () => {
        if (stdout.includes(WINDOWS_FIREWALL_RULE_NAME)) return

        const addRule = spawn('netsh', [
            'advfirewall', 'firewall', 'add', 'rule',
            `name=${WINDOWS_FIREWALL_RULE_NAME}`,
            'dir=in',
            'action=allow',
            `program=${javaExe}`,
            'enable=yes',
            'profile=any',
        ], {stdio: 'ignore', windowsHide: true})
        addRule.on('error', () => undefined)
    })
}
