/**
 * Capture README preview screenshots from the Vue client (mocked API, no backend).
 *
 *   npm run capture:demos --prefix datawise-frontend
 *
 * Output: docs/assets/screenshots/*.png
 */
import {spawn, type ChildProcess} from 'node:child_process'
import {mkdirSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium, type Page} from '@playwright/test'
import ports from '../runtime-ports.json' with {type: 'json'}
import {installAnalysisE2eMocks, installWorkspaceE2eMocks} from '../e2e/helpers/mock-api'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = join(__dirname, '..')
const REPO_ROOT = join(FRONTEND_ROOT, '..')
const OUT_DIR = join(REPO_ROOT, 'docs', 'assets', 'screenshots')
const ORIGIN = `http://127.0.0.1:${ports.frontendE2e}`
const VIEWPORT = {width: 1280, height: 800}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(url: string, timeoutMs: number) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(url)
            if (res.ok) return
        } catch {
            // retry
        }
        await sleep(400)
    }
    throw new Error(`Timed out waiting for ${url}`)
}

function startVite(): Promise<{proc: ChildProcess; stop: () => void}> {
    return new Promise((resolve, reject) => {
        const proc = spawn(
            process.platform === 'win32' ? 'npx.cmd' : 'npx',
            ['vite', '--port', String(ports.frontendE2e), '--strictPort', '--host', '127.0.0.1'],
            {cwd: FRONTEND_ROOT, stdio: 'pipe', shell: process.platform === 'win32'},
        )
        let settled = false
        const stop = () => {
            if (!proc.killed) proc.kill('SIGTERM')
        }
        proc.stderr?.on('data', (chunk: Buffer) => {
            const text = chunk.toString()
            if (text.includes('Error') && !settled) {
                settled = true
                reject(new Error(text))
            }
        })
        waitForServer(ORIGIN, 120_000)
            .then(() => {
                if (!settled) {
                    settled = true
                    resolve({proc, stop})
                }
            })
            .catch((error) => {
                stop()
                reject(error)
            })
    })
}

async function saveShellScreenshot(page: Page, outPath: string) {
    const shell = page.locator('.shell')
    await shell.waitFor({state: 'visible', timeout: 20_000})
    await shell.screenshot({path: outPath, type: 'png', animations: 'disabled'})
}

async function openShell(page: Page) {
    await page.goto(`${ORIGIN}/`)
    await page.locator('.shell').waitFor({state: 'visible', timeout: 20_000})
    const onboarding = page.getByRole('dialog', {name: '新手指引'})
    if (await onboarding.isVisible().catch(() => false)) {
        await page.getByRole('button', {name: '跳过'}).click()
    }
    await sleep(500)
}

async function navTo(page: Page, module: '仪表盘' | '数据库' | 'AI 聊天') {
    await page.locator('nav.tool-stripe__group').first().getByRole('button', {name: module, exact: true}).click()
    await sleep(400)
}

async function captureDashboard(page: Page, outPath: string) {
    await installWorkspaceE2eMocks(page)
    await openShell(page)
    await navTo(page, '仪表盘')
    await sleep(600)
    await saveShellScreenshot(page, outPath)
}

async function captureExplorer(page: Page, outPath: string) {
    await installWorkspaceE2eMocks(page)
    await openShell(page)
    await navTo(page, '数据库')
    await page.locator('.explorer').waitFor({state: 'visible', timeout: 20_000})
    await page.getByText('Test MySQL').waitFor({state: 'visible', timeout: 20_000})
    await page.getByText('Test MySQL').click()
    await sleep(400)
    await page.keyboard.press('Control+K')
    await sleep(500)
    await saveShellScreenshot(page, outPath)
    await page.keyboard.press('Escape')
}

async function captureSqlConsole(page: Page, outPath: string) {
    await installWorkspaceE2eMocks(page)
    await openShell(page)
    await navTo(page, '数据库')
    await page.keyboard.press('Control+Shift+KeyL')
    const editor = page.getByRole('textbox', {name: 'Editor content'})
    await editor.waitFor({state: 'visible', timeout: 15_000})
    await editor.focus()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('SELECT 1 AS id')
    await page.locator('.console-run-btn').click()
    await page.locator('.data-grid .th-label', {hasText: 'id'}).waitFor({timeout: 15_000})
    await sleep(400)
    await saveShellScreenshot(page, outPath)
}

async function captureAiAnalysis(page: Page, outPath: string) {
    await installAnalysisE2eMocks(page)
    await openShell(page)
    await navTo(page, '数据库')
    await page.getByText('Test MySQL').waitFor({state: 'visible', timeout: 20_000})
    await navTo(page, 'AI 聊天')
    await sleep(400)
    const composer = page.getByPlaceholder('发消息…')
    await composer.fill('分析近三个月销售趋势')
    await page.getByRole('button', {name: '发送', exact: true}).click()
    await page.getByText('分析完成', {exact: true}).waitFor({timeout: 20_000}).catch(() => undefined)
    await page.getByText('SELECT 1').waitFor({timeout: 20_000}).catch(() => undefined)
    await sleep(500)
    await saveShellScreenshot(page, outPath)
}

async function main() {
    mkdirSync(OUT_DIR, {recursive: true})
    const {stop} = await startVite()
    const browser = await chromium.launch({headless: true})
    const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 2,
        locale: 'zh-CN',
    })
    await context.addInitScript(() => {
        localStorage.setItem('dw-cli-onboarding-completed', '1')
    })

    const jobs: Array<{name: string; run: (page: Page, out: string) => Promise<void>}> = [
        {name: '01-dashboard', run: captureDashboard},
        {name: '02-explorer', run: captureExplorer},
        {name: '03-sql-console', run: captureSqlConsole},
        {name: '04-ai-analysis', run: captureAiAnalysis},
    ]

    try {
        for (const job of jobs) {
            const page = await context.newPage()
            const outPath = join(OUT_DIR, `${job.name}.png`)
            console.log(`[capture] ${job.name} → ${outPath}`)
            await job.run(page, outPath)
            await page.close()
        }
    } finally {
        await context.close()
        await browser.close()
        stop()
    }

    console.log('[capture] done')
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
