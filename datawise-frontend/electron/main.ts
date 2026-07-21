/**
 * Electron 主进程入口（桌面版专用，运行在 Node 环境，不是浏览器）
 *
 * 职责：
 *   - 创建原生窗口 BrowserWindow
 *   - 开发模式：加载 Vite 开发服（见 runtime-ports.json → dev.frontend）
 *   - 打包后：加载 dist/index.html 静态文件
 *   - Windows/Linux：无边框 + 应用内自定义标题栏
 *   - macOS：hiddenInset + 应用内标题栏（保留系统交通灯）
 *
 * 注意：package.json 的 "type": "module" 下没有 __dirname，需用 import.meta.url 计算路径。
 */
import {app, BrowserWindow, ipcMain, Menu, shell, type WebContents} from 'electron'
import {dirname, join, resolve} from 'path'
import {existsSync} from 'node:fs'
import {fileURLToPath} from 'url'
import {disposeAllTerminalSessions, disposeTerminalSessionsForWebContents, registerTerminalIpc} from './terminal-service'
import {registerConfigDirIpc} from './config-dir-ipc'
import {appendDesktopStartupLog, getBackendStartupState, setBackendStartupProgressListener, startBundledBackendInBackground, stopBundledBackend} from './backend-service'
import {frontendDevOrigin} from '../src/shared/config/runtime-ports'
import {loadAppIconImage} from './app-icon'
import {
    bindCloseToTray,
    disposeTray,
    focusExistingInstance,
    hideMainWindowToTray,
    markAppQuitting,
    setupSystemTray,
    showMainWindow,
} from './tray-service'
import {
    closeSplashAndShowMain,
    createSplashWindow,
    disposeSplashWindow,
    registerSplashBarIpc,
    sendSplashProgress,
    sendSplashProgressFromBackend,
} from './splash-window'
import {
    bindDeepLinkWindowLoad,
    deliverDeepLink,
    handleStartupDeepLink,
    registerDeepLinkIpc,
} from './deep-link-main.service'
import {registerRendererProtocol, rendererAppUrl} from './renderer-protocol'
import {registerRuntimeLogIpc} from './runtime-log-ipc'
import {scheduleDetachedDevTools} from './devtools'
import {registerUpdaterIpc} from './updater-service'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

/** Windows：禁用 overlay 滚动条，使全局 ::-webkit-scrollbar 样式生效 */
if (process.platform === 'win32') {
    app.commandLine.appendSwitch('disable-features', 'OverlayScrollbars')
}

const pendingOpenUrls: string[] = []
let deepLinkHandlersReady = false

function registerDeepLinkProtocolClient() {
    if (process.defaultApp) {
        if (process.argv.length >= 2) {
            app.setAsDefaultProtocolClient('datawise', process.execPath, [resolve(process.argv[1])])
        }
    } else {
        app.setAsDefaultProtocolClient('datawise')
    }
}

registerDeepLinkProtocolClient()

app.on('open-url', (event, url) => {
    event.preventDefault()
    if (deepLinkHandlersReady) {
        deliverDeepLink(url)
    } else {
        pendingOpenUrls.push(url)
    }
})

/** 禁止多开：已在托盘/后台运行时，再次启动仅激活现有窗口 */
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
    app.quit()
} else {
    app.on('second-instance', (_event, argv) => {
        focusExistingInstance(() => mainWindow)
        handleStartupDeepLink(argv)
    })
}

if (process.platform === 'win32') {
    app.setAppUserModelId('org.apache.datawise.cli')
}

interface WindowStatePayload {
    width: number
    height: number
    x?: number | null
    y?: number | null
    maximized?: boolean
}

let mainWindow: BrowserWindow | null = null

function readWindowState(win: BrowserWindow): WindowStatePayload {
    const bounds = win.getBounds()
    return {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        maximized: win.isMaximized(),
    }
}

function bindWindowStateEvents(win: BrowserWindow) {
    const emit = () => {
        win.webContents.send('window:state-changed', readWindowState(win))
    }
    const emitMaximize = () => {
        win.webContents.send('window:maximize-changed', win.isMaximized())
    }
    win.on('resize', emit)
    win.on('move', emit)
    win.on('maximize', () => {
        emit()
        emitMaximize()
    })
    win.on('unmaximize', () => {
        emit()
        emitMaximize()
    })
}

function registerSplashIpc() {
    registerSplashBarIpc()
    ipcMain.on('splash:ready', () => {
        void closeSplashAndShowMain(mainWindow)
    })
    ipcMain.on('splash:progress', (_event, payload: {progress?: number; status?: string}) => {
        if (!payload) return
        sendSplashProgress({
            progress: payload.progress ?? 0,
            status: payload.status,
        })
    })
    ipcMain.on('splash:getMeta', (event) => {
        event.returnValue = {
            version: app.getVersion(),
            tagline: '连接、查询、分析、导出 — 一站完成',
            isPackaged: app.isPackaged,
        }
    })
}

function registerBackendStartupIpc() {
    ipcMain.handle('backend:getStartupState', () => getBackendStartupState())
}

function sanitizeWindowDimension(value: unknown, fallback: number, min: number, max: number): number {
    const num = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(num)) return fallback
    return Math.min(max, Math.max(min, Math.round(num)))
}

function applyWindowBounds(win: BrowserWindow, state: WindowStatePayload): void {
    const width = sanitizeWindowDimension(state.width, 1440, 320, 3840)
    const height = sanitizeWindowDimension(state.height, 900, 240, 2160)
    const hasX = typeof state.x === 'number' && Number.isFinite(state.x)
    const hasY = typeof state.y === 'number' && Number.isFinite(state.y)
    if (hasX && hasY) {
        win.setBounds({
            x: Math.round(state.x as number),
            y: Math.round(state.y as number),
            width,
            height,
        })
        return
    }
    win.setSize(width, height)
}

function registerWindowIpc() {
    ipcMain.on('get-is-packaged', (event) => {
        event.returnValue = app.isPackaged
    })
    ipcMain.handle('window:getState', () => (mainWindow ? readWindowState(mainWindow) : null))
    ipcMain.handle('window:setState', (_event, state: WindowStatePayload) => {
        if (!mainWindow || !state) return false
        if (state.maximized) {
            mainWindow.maximize()
            return true
        }
        if (mainWindow.isMaximized()) mainWindow.unmaximize()
        try {
            applyWindowBounds(mainWindow, state)
        } catch (error) {
            appendDesktopStartupLog(`window:setState failed: ${String(error)}`)
            return false
        }
        return true
    })
    ipcMain.handle('window:minimize', () => {
        mainWindow?.minimize()
        return true
    })
    ipcMain.handle('window:toggleMaximize', () => {
        if (!mainWindow) return false
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize()
        } else {
            mainWindow.maximize()
        }
        return mainWindow.isMaximized()
    })
    ipcMain.handle('window:close', () => {
        hideMainWindowToTray(mainWindow, () => mainWindow)
        return true
    })
    ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
}

function resolvePreloadPath(): string {
    const fromApp = join(app.getAppPath(), 'dist-electron', 'preload.mjs')
    if (existsSync(fromApp)) return fromApp
    return join(__dirname, 'preload.mjs')
}

function resolveRendererIndexPath(): string {
    const fromApp = join(app.getAppPath(), 'dist', 'index.html')
    if (existsSync(fromApp)) return fromApp
    return join(__dirname, '../dist/index.html')
}

function bindRendererDiagnostics(contents: WebContents) {
    contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        appendDesktopStartupLog(
            `renderer did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}`,
        )
    })
    contents.on('did-finish-load', () => {
        appendDesktopStartupLog('renderer did-finish-load')
    })
    contents.on('render-process-gone', (_event, details) => {
        appendDesktopStartupLog(
            `renderer process gone reason=${details.reason} exitCode=${details.exitCode}`,
        )
    })
    contents.on('console-message', (_event, level, message, line, sourceId) => {
        // 仅记录渲染进程 error，避免 Vue/Monaco warn 刷屏
        if (level >= 3) {
            appendDesktopStartupLog(`renderer error ${message} (${sourceId}:${line})`)
        }
    })
}

function createWindow() {
    const isMac = process.platform === 'darwin'
    const useFramelessChrome = process.platform === 'win32' || process.platform === 'linux'
    const windowIcon = loadAppIconImage()

    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1100,
        minHeight: 680,
        show: false,
        title: 'DataWise CLI',
        icon: windowIcon.isEmpty() ? undefined : windowIcon,
        backgroundColor: '#ffffff',
        frame: !useFramelessChrome && !isMac,
        titleBarStyle: isMac ? 'hiddenInset' : 'default',
        trafficLightPosition: {x: 12, y: 10},
        webPreferences: {
            preload: resolvePreloadPath(),
            contextIsolation: true,
            nodeIntegration: false,
        },
    })

    bindRendererDiagnostics(mainWindow.webContents)
    bindWindowStateEvents(mainWindow)
    bindDeepLinkWindowLoad(mainWindow)
    bindCloseToTray(mainWindow, () => mainWindow)
    const windowContents = mainWindow.webContents
    windowContents.on('destroyed', () => {
        disposeTerminalSessionsForWebContents(windowContents)
    })

    if (isDev) {
        void mainWindow.loadURL(frontendDevOrigin())
        scheduleDetachedDevTools(mainWindow)
    } else {
        const indexPath = resolveRendererIndexPath()
        const rendererUrl = rendererAppUrl()
        appendDesktopStartupLog(`loading renderer ${rendererUrl} (file=${indexPath})`)
        void mainWindow.loadURL(rendererUrl)
    }

    mainWindow.webContents.setWindowOpenHandler(({url}) => {
        shell.openExternal(url)
        return {action: 'deny'}
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

function startPackagedBackendAsync() {
    setBackendStartupProgressListener((event) => {
        mainWindow?.webContents.send('backend:startup-progress', event)
        sendSplashProgressFromBackend(event)
    })

    void startBundledBackendInBackground()
        .then((ready) => {
            appendDesktopStartupLog(`backend startup ${ready ? 'ready' : 'failed'}`)
            if (!ready) app.quit()
        })
        .catch((error) => {
            appendDesktopStartupLog(`backend startup crashed: ${String(error)}`)
            app.quit()
        })
}

function setupApplicationMenu() {
    if (process.platform === 'win32' || process.platform === 'linux') {
        Menu.setApplicationMenu(null)
        return
    }
    buildMenu()
}

function buildMenu() {
    const isMac = process.platform === 'darwin'
    const template: Electron.MenuItemConstructorOptions[] = [
        ...(isMac
            ? [{
                label: 'DataWise CLI',
                submenu: [
                    {role: 'about' as const},
                    {type: 'separator' as const},
                    {role: 'services' as const},
                    {type: 'separator' as const},
                    {role: 'hide' as const},
                    {role: 'hideOthers' as const},
                    {role: 'unhide' as const},
                    {type: 'separator' as const},
                    {role: 'quit' as const, label: '退出'},
                ],
            }]
            : [{
                label: '文件',
                submenu: [{role: 'quit' as const, label: '退出'}],
            }]),
        {
            label: '编辑',
            submenu: [
                {role: 'undo', label: '撤销'},
                {role: 'redo', label: '重做'},
                {type: 'separator'},
                {role: 'cut', label: '剪切'},
                {role: 'copy', label: '复制'},
                {role: 'paste', label: '粘贴'},
                {role: 'selectAll', label: '全选'},
            ],
        },
        {
            label: '视图',
            submenu: [
                {role: 'reload', label: '刷新'},
                {role: 'forceReload', label: '强制刷新'},
                {type: 'separator'},
                {role: 'resetZoom', label: '重置缩放'},
                {role: 'zoomIn', label: '放大'},
                {role: 'zoomOut', label: '缩小'},
                {type: 'separator'},
                {role: 'togglefullscreen', label: '全屏'},
            ],
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '官网',
                    click: () => shell.openExternal('https://datawise.apache.org'),
                },
                {
                    label: '文档',
                    click: () => shell.openExternal('https://datawise.apache.org/docs'),
                },
                {type: 'separator'},
                {role: 'toggleDevTools', label: '开发者工具'},
            ],
        },
    ]

    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
    if (!gotSingleInstanceLock) return

    registerWindowIpc()
    registerSplashIpc()
    registerBackendStartupIpc()
    registerUpdaterIpc(() => mainWindow)
    registerTerminalIpc()
    registerConfigDirIpc()
    registerRuntimeLogIpc()
    registerDeepLinkIpc(() => mainWindow)
    setupApplicationMenu()

    if (!isDev) {
        registerRendererProtocol()
    }

    createSplashWindow(resolvePreloadPath)
    createWindow()
    setupSystemTray(() => mainWindow)

    if (!isDev) {
        startPackagedBackendAsync()
    }

    deepLinkHandlersReady = true
    for (const url of pendingOpenUrls) deliverDeepLink(url)
    pendingOpenUrls.length = 0
    handleStartupDeepLink()

    app.on('activate', () => {
        if (mainWindow) {
            showMainWindow(mainWindow)
            return
        }
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('before-quit', () => {
    markAppQuitting()
    disposeSplashWindow()
    disposeTray()
    stopBundledBackend()
    disposeAllTerminalSessions()
})

app.on('window-all-closed', () => {
    // 隐藏到托盘时窗口未销毁，不会触发 quit；仅 macOS 无窗口时保持进程
    if (process.platform !== 'darwin' && !mainWindow) {
        app.quit()
    }
})
