/** Preload 注入的只读桌面桥（Electron）；渲染进程组装 window.datawise 前可用 */
export function readDesktopBridge(): Window['__datawiseDesktopBridge'] | undefined {
    if (typeof window === 'undefined') return undefined
    return window.__datawiseDesktopBridge
}

/** 桌面桥或已组装的 window.datawise（含 plugin hooks） */
export function readDatawiseHost(): NonNullable<Window['datawise']> | undefined {
    if (typeof window === 'undefined') return undefined
    return window.datawise ?? readDesktopBridge()
}
