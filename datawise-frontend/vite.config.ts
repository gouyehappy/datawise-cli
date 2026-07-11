/**
 * Vite 构建配置
 *
 * - 平时 npm run dev：只编译 Vue 前端
 * - ELECTRON=true 时：额外编译 electron/main.ts 和 preload，且 base 改为 './' 方便打包后加载资源
 * - '@' 别名指向 src/，所以代码里可以用 import X from '@/core/...'
 */
import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {resolve} from 'path'
import {sqlEditorAliasPlugin} from './vite/sql-editor-alias'
import {electronBuildPlugin} from './vite/electron-build-plugin'
import ports from './runtime-ports.json' with {type: 'json'}

const enableElectron = process.env.ELECTRON === 'true'
const backendOrigin = `http://127.0.0.1:${ports.backend}`

export default defineConfig(async () => {
    const plugins = [vue(), sqlEditorAliasPlugin()]

    if (enableElectron) {
        plugins.push(electronBuildPlugin())
        const electron = (await import('vite-plugin-electron/simple')).default
        plugins.push(
            electron({
                main: {
                    entry: 'electron/main.ts',
                    vite: {
                        build: {
                            rollupOptions: {
                                external: ['node-pty'],
                            },
                        },
                    },
                },
                preload: {input: 'electron/preload.ts'},
            }),
        )
    }

    return {
        base: enableElectron ? './' : '/',
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
            port: ports.frontendDev,
            strictPort: true,
            fs: {
                // sql-editor 在 frontend 包外，Worker 与 alias 需读取 ../sql-editor
                allow: [resolve(__dirname, '..')],
            },
            proxy: {
                '/login': {target: backendOrigin, changeOrigin: true},
                '/signOut': {target: backendOrigin, changeOrigin: true},
                '/api': {target: backendOrigin, changeOrigin: true},
            },
        },
    }
})
