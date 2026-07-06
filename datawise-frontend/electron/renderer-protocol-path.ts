import {isAbsolute, relative, resolve} from 'path'

export function resolveRendererDistFile(distRoot: string, pathname: string): string | null {
    let relativePath: string
    try {
        relativePath = decodeURIComponent(pathname)
    } catch {
        return null
    }

    if (relativePath === '/' || relativePath === '') {
        relativePath = '/index.html'
    }
    if (relativePath.startsWith('/')) {
        relativePath = relativePath.slice(1)
    }

    const root = resolve(distRoot)
    const filePath = resolve(root, relativePath)
    const fromRoot = relative(root, filePath)
    if (fromRoot === '' || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
        return null
    }
    return filePath
}