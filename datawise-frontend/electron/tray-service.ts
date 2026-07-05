import {app, BrowserWindow, Menu, Notification, Tray} from 'electron'
import {loadTrayIconImage} from './app-icon'

let tray: Tray | null = null
let quitting = false

const TRAY_HIDE_NOTIFICATION = {
    title: 'DataWise CLI',
    body: '程序已隐藏到系统托盘。再次启动将直接打开此窗口；右键托盘图标可退出。',
}

export function markAppQuitting() {
    quitting = true
}

export function isAppQuitting(): boolean {
    return quitting
}

export function showMainWindow(win: BrowserWindow | null) {
    if (!win) return
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    win.focus()
}

function notifyHiddenToTray() {
    if (!Notification.isSupported()) return
    const notification = new Notification(TRAY_HIDE_NOTIFICATION)
    notification.show()
}

export function hideMainWindowToTray(win: BrowserWindow | null, notify = true) {
    if (!win || !win.isVisible()) return
    win.hide()
    if (notify) notifyHiddenToTray()
}

export function bindCloseToTray(win: BrowserWindow) {
    win.on('close', (event) => {
        if (quitting) return
        event.preventDefault()
        hideMainWindowToTray(win)
    })
}

export function setupSystemTray(getWindow: () => BrowserWindow | null) {
    if (tray) return

    const image = loadTrayIconImage()
    tray = new Tray(image)
    tray.setToolTip('DataWise CLI')

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示主窗口',
            click: () => showMainWindow(getWindow()),
        },
        {type: 'separator'},
        {
            label: '退出',
            click: () => {
                markAppQuitting()
                disposeTray()
                app.quit()
            },
        },
    ])
    tray.setContextMenu(contextMenu)
    tray.on('double-click', () => showMainWindow(getWindow()))

    if (process.platform === 'win32') {
        tray.on('click', () => showMainWindow(getWindow()))
    }
}

export function disposeTray() {
    tray?.destroy()
    tray = null
}

export function focusExistingInstance(getWindow: () => BrowserWindow | null) {
    const win = getWindow()
    if (win) {
        showMainWindow(win)
        return
    }
    if (BrowserWindow.getAllWindows().length > 0) {
        showMainWindow(BrowserWindow.getAllWindows()[0])
    }
}
