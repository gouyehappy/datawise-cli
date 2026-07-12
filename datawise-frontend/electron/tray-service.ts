import {app, BrowserWindow, Menu, Notification, Tray} from 'electron'
import {loadTrayIconImage, resolveAppIconPath} from './app-icon'

let tray: Tray | null = null
let quitting = false

const TRAY_HIDE_NOTIFICATION = {
    title: 'DataWise CLI',
    body: '已在后台继续运行。点击通知或托盘图标可恢复窗口，右键托盘图标可退出。',
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

function notifyHiddenToTray(getWindow: () => BrowserWindow | null) {
    if (!Notification.isSupported()) return

    const notification = new Notification({
        ...TRAY_HIDE_NOTIFICATION,
        icon: resolveAppIconPath() ?? undefined,
    })
    notification.on('click', () => showMainWindow(getWindow()))
    notification.show()
}

export function hideMainWindowToTray(
    win: BrowserWindow | null,
    getWindow: () => BrowserWindow | null,
    notify = true,
) {
    if (!win || !win.isVisible()) return
    win.hide()
    if (notify) notifyHiddenToTray(getWindow)
}

export function bindCloseToTray(win: BrowserWindow, getWindow: () => BrowserWindow | null) {
    win.on('close', (event) => {
        if (quitting) return
        event.preventDefault()
        hideMainWindowToTray(win, getWindow)
    })
}

export function setupSystemTray(getWindow: () => BrowserWindow | null) {
    if (tray) return

    const image = loadTrayIconImage()
    tray = new Tray(image)
    tray.setToolTip('DataWise CLI')

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '打开主窗口',
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
