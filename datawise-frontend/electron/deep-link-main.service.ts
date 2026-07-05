import {ipcMain, type BrowserWindow} from 'electron'
import {
    extractDeepLinkFromArgv,
    parseDeepLinkUrl,
} from '../src/shared/deep-link/deep-link.service'
import type {DeepLinkOpenPayload} from '../src/shared/deep-link/deep-link.types'
import {showMainWindow} from './tray-service'

let pendingDeepLink: DeepLinkOpenPayload | null = null
let resolveMainWindow: () => BrowserWindow | null = () => null

function sendToRenderer(win: BrowserWindow, payload: DeepLinkOpenPayload) {
    win.webContents.send('deep-link:open', payload)
    showMainWindow(win)
}

export function deliverDeepLink(rawUrl: string) {
    const payload = parseDeepLinkUrl(rawUrl)
    if (!payload) return

    const win = resolveMainWindow()
    if (win && !win.webContents.isLoading()) {
        sendToRenderer(win, payload)
        return
    }

    pendingDeepLink = payload
}

export function registerDeepLinkIpc(getMainWindow: () => BrowserWindow | null) {
    resolveMainWindow = getMainWindow

    ipcMain.handle('deep-link:flushPending', () => {
        const payload = pendingDeepLink
        pendingDeepLink = null
        return payload
    })
}

export function bindDeepLinkWindowLoad(win: BrowserWindow) {
    win.webContents.on('did-finish-load', () => {
        if (!pendingDeepLink) return
        sendToRenderer(win, pendingDeepLink)
        pendingDeepLink = null
    })
}

export function handleStartupDeepLink(argv: string[] = process.argv) {
    const url = extractDeepLinkFromArgv(argv)
    if (url) deliverDeepLink(url)
}
