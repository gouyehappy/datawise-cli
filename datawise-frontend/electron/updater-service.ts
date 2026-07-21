/**
 * Desktop auto-update via electron-updater + GitHub Releases.
 * Packaged builds only; unpackaged / web fall back to “no update”.
 */
import {app, BrowserWindow, ipcMain} from 'electron'
import electronUpdater from 'electron-updater'
import type {ProgressInfo, UpdateInfo} from 'electron-updater'
import {markAppQuitting} from './tray-service'
import {humanizeUpdaterError} from './updater-errors'

export {humanizeUpdaterError} from './updater-errors'

const {autoUpdater} = electronUpdater

/** Stable redirect for latest.yml / installers — avoids GitHubProvider /releases/latest JSON 406. */
export const GITHUB_LATEST_DOWNLOAD_URL =
    'https://github.com/gouyehappy/datawise-cli/releases/latest/download'

export interface UpdatePreferences {
    notifyOnUpdate: boolean
    autoDownload: boolean
}

export interface UpdateCheckResult {
    currentVersion: string
    latestVersion: string
    hasUpdate: boolean
    downloadReady?: boolean
    downloading?: boolean
    error?: string
}

export interface UpdateStatusEvent {
    phase: 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available'
    currentVersion: string
    latestVersion: string
    percent?: number
    error?: string
}

const DEFAULT_PREFS: UpdatePreferences = {
    notifyOnUpdate: true,
    autoDownload: true,
}

let preferences: UpdatePreferences = {...DEFAULT_PREFS}
let latestInfo: UpdateInfo | null = null
let downloadReady = false
let downloading = false
let startupCheckScheduled = false
let getMainWindow: () => BrowserWindow | null = () => null

function currentVersion(): string {
    return app.getVersion()
}

function emitStatus(event: UpdateStatusEvent) {
    const win = getMainWindow()
    win?.webContents.send('updater:status', event)
}

function toCheckResult(overrides: Partial<UpdateCheckResult> = {}): UpdateCheckResult {
    const latest = latestInfo?.version ?? currentVersion()
    return {
        currentVersion: currentVersion(),
        latestVersion: latest,
        hasUpdate: Boolean(latestInfo && latestInfo.version !== currentVersion()),
        downloadReady,
        downloading,
        ...overrides,
    }
}

async function downloadIfAllowed(): Promise<void> {
    if (!latestInfo || downloadReady || downloading) return
    if (!preferences.autoDownload) return
    downloading = true
    emitStatus({
        phase: 'downloading',
        currentVersion: currentVersion(),
        latestVersion: latestInfo.version,
        percent: 0,
    })
    try {
        await autoUpdater.downloadUpdate()
    } catch (error) {
        downloading = false
        const message = humanizeUpdaterError(error instanceof Error ? error.message : String(error))
        emitStatus({
            phase: 'error',
            currentVersion: currentVersion(),
            latestVersion: latestInfo?.version ?? currentVersion(),
            error: message,
        })
    }
}

function configureAutoUpdater() {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowDowngrade = false

    // electron-updater's GitHubProvider calls /releases/latest with Accept: application/json,
    // which GitHub now often answers with 406 — breaking checkForUpdates even when releases exist.
    // The generic provider only needs .../releases/latest/download/latest.yml (works as a redirect).
    if (app.isPackaged) {
        autoUpdater.setFeedURL({
            provider: 'generic',
            url: GITHUB_LATEST_DOWNLOAD_URL,
        })
    }

    autoUpdater.on('update-available', (info) => {
        latestInfo = info
        downloadReady = false
        emitStatus({
            phase: 'available',
            currentVersion: currentVersion(),
            latestVersion: info.version,
        })
        void downloadIfAllowed()
    })

    autoUpdater.on('update-not-available', (info) => {
        latestInfo = null
        downloadReady = false
        downloading = false
        emitStatus({
            phase: 'not-available',
            currentVersion: currentVersion(),
            latestVersion: info.version,
        })
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        downloading = true
        emitStatus({
            phase: 'downloading',
            currentVersion: currentVersion(),
            latestVersion: latestInfo?.version ?? currentVersion(),
            percent: Math.round(progress.percent),
        })
    })

    autoUpdater.on('update-downloaded', (info) => {
        latestInfo = info
        downloading = false
        downloadReady = true
        emitStatus({
            phase: 'downloaded',
            currentVersion: currentVersion(),
            latestVersion: info.version,
        })
    })

    autoUpdater.on('error', (error) => {
        downloading = false
        emitStatus({
            phase: 'error',
            currentVersion: currentVersion(),
            latestVersion: latestInfo?.version ?? currentVersion(),
            error: humanizeUpdaterError(error?.message || String(error)),
        })
    })
}

async function checkForUpdatesInternal(silent: boolean): Promise<UpdateCheckResult> {
    if (!app.isPackaged) {
        const envLatest = process.env.DATAWISE_LATEST_VERSION?.trim()
        if (envLatest && envLatest !== currentVersion()) {
            latestInfo = {version: envLatest} as UpdateInfo
            return toCheckResult({hasUpdate: true, latestVersion: envLatest})
        }
        return toCheckResult({
            latestVersion: currentVersion(),
            hasUpdate: false,
        })
    }

    try {
        const result = await autoUpdater.checkForUpdates()
        if (result?.updateInfo) {
            const remote = result.updateInfo.version
            const hasUpdate = remote !== currentVersion()
            if (hasUpdate) {
                latestInfo = result.updateInfo
            } else {
                latestInfo = null
                downloadReady = false
            }
            return toCheckResult({
                latestVersion: remote,
                hasUpdate,
            })
        }
        return toCheckResult()
    } catch (error) {
        const message = humanizeUpdaterError(error instanceof Error ? error.message : String(error))
        if (!silent) {
            emitStatus({
                phase: 'error',
                currentVersion: currentVersion(),
                latestVersion: latestInfo?.version ?? currentVersion(),
                error: message,
            })
        }
        return toCheckResult({error: message, hasUpdate: false})
    }
}

function scheduleStartupCheck() {
    if (startupCheckScheduled || !app.isPackaged) return
    startupCheckScheduled = true
    setTimeout(() => {
        void checkForUpdatesInternal(true)
    }, 8_000)
}

export function registerUpdaterIpc(getWindow: () => BrowserWindow | null) {
    getMainWindow = getWindow
    configureAutoUpdater()

    ipcMain.handle('updater:checkForUpdates', async (): Promise<UpdateCheckResult> => {
        return checkForUpdatesInternal(false)
    })

    ipcMain.handle('updater:downloadUpdate', async (): Promise<UpdateCheckResult> => {
        if (!app.isPackaged) {
            return toCheckResult({error: 'Updates are only available in packaged builds'})
        }
        if (!latestInfo) {
            const checked = await checkForUpdatesInternal(false)
            if (!checked.hasUpdate) return checked
        }
        if (downloadReady) return toCheckResult()
        if (downloading) return toCheckResult()
        downloading = true
        try {
            await autoUpdater.downloadUpdate()
            return toCheckResult()
        } catch (error) {
            downloading = false
            const message = humanizeUpdaterError(error instanceof Error ? error.message : String(error))
            return toCheckResult({error: message})
        }
    })

    ipcMain.handle('updater:quitAndInstall', (): boolean => {
        if (!downloadReady) return false
        markAppQuitting()
        setImmediate(() => {
            autoUpdater.quitAndInstall(false, true)
        })
        return true
    })

    ipcMain.handle('updater:setPreferences', (_event, prefs: Partial<UpdatePreferences> | null) => {
        preferences = {
            notifyOnUpdate: prefs?.notifyOnUpdate ?? preferences.notifyOnUpdate,
            autoDownload: prefs?.autoDownload ?? preferences.autoDownload,
        }
        scheduleStartupCheck()
        if (preferences.autoDownload && latestInfo && !downloadReady && !downloading) {
            void downloadIfAllowed()
        }
        return true
    })

    ipcMain.handle('updater:getStatus', (): UpdateCheckResult => toCheckResult())
}
