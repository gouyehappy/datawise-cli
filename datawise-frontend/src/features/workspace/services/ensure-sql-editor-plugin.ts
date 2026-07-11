import type {App} from 'vue'

let hostApp: App | null = null
let installed = false
let installPromise: Promise<void> | null = null

/** 在 main.ts 挂载后注册，供延迟安装 SqlEditor 插件使用 */
export function registerSqlEditorApp(app: App): void {
    hostApp = app
}

/** 首次打开 SQL 编辑器或相关设置时再加载 Monaco Worker 与插件，缩短冷启动 */
export function ensureSqlEditorPlugin(): Promise<void> {
    if (installed) return Promise.resolve()
    if (!installPromise) {
        installPromise = (async () => {
            await import('@/monaco-electron-workers')
            const [{installSqlEditorPlugin, getDefaultSqlEditorRuntime}, {useDatawiseSqlEditorHost}] =
                await Promise.all([
                    import('@datawise/sql-editor'),
                    import('@/features/workspace/adapters/datawise-sql-editor-host'),
                ])
            const app = hostApp
            if (!app) {
                throw new Error('SqlEditor plugin host app is not registered')
            }
            // 复用 app-config 启动时已绑定的 runtime，避免片段/设置与编辑器不同步
            installSqlEditorPlugin(app, {
                config: useDatawiseSqlEditorHost(),
                runtime: getDefaultSqlEditorRuntime(),
            })
            installed = true
        })().catch((error) => {
            installPromise = null
            throw error
        })
    }
    return installPromise
}
