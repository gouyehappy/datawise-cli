import {app, type BrowserWindow} from 'electron'

/** 开发模式：以独立窗口打开 Chromium DevTools */
export function openDetachedDevTools(win: BrowserWindow | null | undefined): void {
    if (!win || win.isDestroyed() || app.isPackaged) return
    if (win.webContents.isDevToolsOpened()) return
    win.webContents.openDevTools({mode: 'detach'})
}

/** 等渲染页就绪后再打开 DevTools（主窗口初始为 hidden 时更可靠） */
export function scheduleDetachedDevTools(win: BrowserWindow): void {
    if (app.isPackaged) return

    const open = () => openDetachedDevTools(win)

    if (win.webContents.isLoading()) {
        win.webContents.once('did-finish-load', open)
        return
    }

    open()
}
