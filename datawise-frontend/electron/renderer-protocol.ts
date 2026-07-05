/**
 * 打包后用 app:// 提供 dist/ 静态资源，避免 file:// 下 ES module / Worker 白屏。
 */
import {app, net, protocol} from 'electron'
import {join} from 'path'
import {pathToFileURL} from 'node:url'

export const APP_RENDERER_SCHEME = 'app'

protocol.registerSchemesAsPrivileged([
    {
        scheme: APP_RENDERER_SCHEME,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            bypassCSP: true,
        },
    },
])

function resolveDistRoot(): string {
    return join(app.getAppPath(), 'dist')
}

function resolveDistFile(pathname: string): string {
    let relative = decodeURIComponent(pathname)
    if (relative === '/' || relative === '') {
        relative = '/index.html'
    }
    if (relative.startsWith('/')) {
        relative = relative.slice(1)
    }
    return join(resolveDistRoot(), relative)
}

export function registerRendererProtocol(): void {
    protocol.handle(APP_RENDERER_SCHEME, (request) => {
        const filePath = resolveDistFile(new URL(request.url).pathname)
        return net.fetch(pathToFileURL(filePath).toString())
    })
}

export function rendererAppUrl(): string {
    return `${APP_RENDERER_SCHEME}://local/index.html`
}
