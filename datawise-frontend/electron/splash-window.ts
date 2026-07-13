import {app, BrowserWindow, ipcMain} from 'electron'
import {dirname, join} from 'path'
import {existsSync} from 'fs'
import {fileURLToPath} from 'url'
import {loadAppIconImage} from './app-icon'
import {openDetachedDevTools} from './devtools'
import {
    SPLASH_HEIGHT,
    SPLASH_WIDTH,
    resolveSplashStatus,
} from './splash-status'

export {SPLASH_WIDTH, SPLASH_HEIGHT} from './splash-status'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SPLASH_MIN_VISIBLE_MS = 3_200
const SPLASH_AT_100_HOLD_MS = 1_600
const MAIN_REVEAL_DELAY_MS = 350

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

let splashWindow: BrowserWindow | null = null
let splashShownAt = 0
let lastBarPaintedProgress = 0
let barCompleteWaiters: Array<() => void> = []

export interface SplashProgressPayload {
    progress: number
    status?: string
}

function resolveSplashHtmlPath(): string {
    const candidates = [
        join(__dirname, 'splash.html'),
        join(app.getAppPath(), 'dist-electron', 'splash.html'),
        join(app.getAppPath(), 'electron', 'splash.html'),
    ]
    for (const path of candidates) {
        if (existsSync(path)) return path
    }
    return join(__dirname, 'splash.html')
}

export function registerSplashBarIpc(): void {
    ipcMain.on('splash:bar-painted', (_event, progress: unknown) => {
        markSplashBarPainted(typeof progress === 'number' ? progress : Number(progress) || 0)
    })
    ipcMain.handle('splash:waitBarComplete', async (_event, targetProgress: unknown) => {
        const target = typeof targetProgress === 'number' ? targetProgress : Number(targetProgress) || 100
        await waitSplashBarPainted(target, 8_000)
        return true
    })
}

export function markSplashBarPainted(progress: number): void {
    const normalized = Math.max(0, Math.min(100, Math.round(progress)))
    lastBarPaintedProgress = Math.max(lastBarPaintedProgress, normalized)
    if (lastBarPaintedProgress >= 100) {
        const waiters = barCompleteWaiters
        barCompleteWaiters = []
        waiters.forEach((resolve) => resolve())
    }
}

export function waitSplashBarPainted(minProgress: number, timeoutMs: number): Promise<void> {
    if (lastBarPaintedProgress >= minProgress) {
        return Promise.resolve()
    }
    return Promise.race([
        new Promise<void>((resolve) => {
            barCompleteWaiters.push(resolve)
        }),
        delay(timeoutMs),
    ])
}

export function createSplashWindow(resolvePreloadPath: () => string): void {
    if (splashWindow) return

    lastBarPaintedProgress = 0
    barCompleteWaiters = []

    const icon = loadAppIconImage()
    splashWindow = new BrowserWindow({
        width: SPLASH_WIDTH,
        height: SPLASH_HEIGHT,
        frame: false,
        transparent: false,
        backgroundColor: '#f8fafc',
        roundedCorners: true,
        hasShadow: true,
        resizable: false,
        maximizable: false,
        minimizable: false,
        fullscreenable: false,
        center: true,
        show: false,
        skipTaskbar: false,
        title: 'DataWise CLI',
        icon: icon.isEmpty() ? undefined : icon,
        webPreferences: {
            preload: resolvePreloadPath(),
            contextIsolation: true,
            nodeIntegration: false,
        },
    })

    splashWindow.setMenuBarVisibility(false)
    void splashWindow.loadFile(resolveSplashHtmlPath())
    splashShownAt = Date.now()
    splashWindow.once('ready-to-show', () => {
        splashWindow?.show()
    })
    splashWindow.on('closed', () => {
        splashWindow = null
    })
}

export function sendSplashProgress(payload: SplashProgressPayload): void {
    if (!splashWindow || splashWindow.isDestroyed()) return
    const progress = Math.max(0, Math.min(100, Math.round(payload.progress)))
    const fallbackStatus = resolveSplashStatus('idle', app.isPackaged)
    splashWindow.webContents.send('splash:progress', {
        progress,
        status: payload.status ?? fallbackStatus,
    })
}

export function sendSplashProgressFromBackend(event: {phase: string; progress: number}): void {
    sendSplashProgress({
        progress: event.progress,
        status: resolveSplashStatus(event.phase, app.isPackaged),
    })
}

export async function closeSplashAndShowMain(mainWindow: BrowserWindow | null): Promise<void> {
    await Promise.race([
        waitSplashBarPainted(100, 8_000),
        delay(SPLASH_AT_100_HOLD_MS + 400),
    ])
    await delay(SPLASH_AT_100_HOLD_MS)

    const elapsed = Date.now() - splashShownAt
    if (elapsed < SPLASH_MIN_VISIBLE_MS) {
        await delay(SPLASH_MIN_VISIBLE_MS - elapsed)
    }

    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close()
    }
    splashWindow = null

    await delay(MAIN_REVEAL_DELAY_MS)

    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
    openDetachedDevTools(mainWindow)
}

export function disposeSplashWindow(): void {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy()
    }
    splashWindow = null
    lastBarPaintedProgress = 0
    barCompleteWaiters = []
}
