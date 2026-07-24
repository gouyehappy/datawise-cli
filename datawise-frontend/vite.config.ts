/**
 * Vite 构建配置
 *
 * - 平时 npm run dev：只编译 Vue 前端
 * - ELECTRON=true 时：额外编译 electron/main.ts 和 preload，且 base 改为 './' 方便打包后加载资源
 * - '@' 别名指向 src/，所以代码里可以用 import X from '@/core/...'
 */
import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {copyFileSync, mkdirSync} from 'node:fs'
import {resolve, dirname, join} from 'path'
import {fileURLToPath} from 'node:url'
import {sqlEditorAliasPlugin} from './vite/sql-editor-alias'
import {electronBuildPlugin} from './vite/electron-build-plugin'
import ports from './runtime-ports.json' with {type: 'json'}

const enableElectron = process.env.ELECTRON === 'true'
const enableDesktopPackaging = process.env.DATAWISE_DESKTOP === 'true'
const backendOrigin = `http://127.0.0.1:${ports.dev.backend}`
const projectRoot = dirname(fileURLToPath(import.meta.url))

function copyElectronStaticAssets() {
    const copySplash = () => {
        const outDir = join(projectRoot, 'dist-electron')
        mkdirSync(outDir, {recursive: true})
        copyFileSync(join(projectRoot, 'electron/splash.html'), join(outDir, 'splash.html'))
    }
    return {
        name: 'copy-electron-static-assets',
        buildStart() {
            if (process.env.ELECTRON === 'true') copySplash()
        },
        closeBundle() {
            if (process.env.ELECTRON === 'true') copySplash()
        },
    } satisfies import('vite').Plugin
}

export default defineConfig(async () => {
    const plugins = [vue(), sqlEditorAliasPlugin()]

    if (enableElectron) {
        plugins.push(electronBuildPlugin())
        plugins.push(copyElectronStaticAssets())
        const electron = (await import('vite-plugin-electron/simple')).default
        plugins.push(
            electron({
                main: {
                    entry: 'electron/main.ts',
                    vite: {
                        build: {
                            rollupOptions: {
                                external: ['node-pty', 'electron-updater'],
                            },
                        },
                    },
                },
                preload: {input: 'electron/preload.ts'},
            }),
        )
    }

    return {
        base: enableElectron || enableDesktopPackaging ? './' : '/',
        plugins,
        build: enableElectron
            ? {
                modulePreload: false,
                rollupOptions: {
                    output: {
                        manualChunks(id) {
                            if (id.includes('node_modules/monaco-editor')) return 'monaco'
                            if (id.includes('node_modules/echarts')) return 'echarts'
                            if (id.includes('node_modules/exceljs') || id.includes('node_modules/xlsx')) {
                                return 'spreadsheet'
                            }
                        },
                    },
                },
            }
            : {
                rollupOptions: {
                    output: {
                        manualChunks(id) {
                            if (id.includes('node_modules/monaco-editor')) return 'monaco'
                            if (id.includes('node_modules/echarts')) return 'echarts'
                            if (id.includes('node_modules/exceljs') || id.includes('node_modules/xlsx')) {
                                return 'spreadsheet'
                            }
                        },
                    },
                },
            },
        worker: {
            format: 'es',
        },
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src'),
                '@datawise/sql-editor': resolve(__dirname, '../sql-editor/src'),
                '@sql-editor': resolve(__dirname, '../sql-editor/src'),
            },
        },
        optimizeDeps: {
            include: ['monaco-editor'],
        },
        server: {
            host: '127.0.0.1',
            port: ports.dev.frontend,
            strictPort: true,
            fs: {
                // sql-editor 在 frontend 包外，Worker 与 alias 需读取 ../sql-editor
                allow: [resolve(__dirname, '..')],
            },
            proxy: {
                '/login': {target: backendOrigin, changeOrigin: true},
                '/signOut': {target: backendOrigin, changeOrigin: true},
                '/api': {target: backendOrigin, changeOrigin: true},
                // SSH / local PTY terminal WebSockets (browser cannot set custom auth headers)
                '/ws': {target: backendOrigin, changeOrigin: true, ws: true},
            },
        },
    }
})
