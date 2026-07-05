import type {Plugin} from 'vite'

/**
 * Electron 通过 loadFile(file://) 加载 dist/index.html 时，Vite 默认注入的
 * crossorigin 会导致 ES module / CSS 加载失败（白屏且无报错）。
 */
export function electronBuildPlugin(): Plugin {
    return {
        name: 'electron-build-html',
        apply: 'build',
        transformIndexHtml(html) {
            return html.replace(/\s+crossorigin(="anonymous")?/g, '')
        },
    }
}
