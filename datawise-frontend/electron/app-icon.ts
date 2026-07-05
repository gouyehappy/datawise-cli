import {app, nativeImage} from 'electron'
import type {NativeImage} from 'electron'
import {existsSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))

function candidateIconPaths(): string[] {
    const paths: string[] = []
    if (app.isPackaged) {
        paths.push(join(app.getAppPath(), 'build', 'icon.png'))
    }
    paths.push(join(moduleDir, '../build/icon.png'))
    return paths
}

export function resolveAppIconPath(): string {
    for (const candidate of candidateIconPaths()) {
        if (existsSync(candidate)) return candidate
    }
    return candidateIconPaths()[0]
}

export function loadAppIconImage(): NativeImage {
    return nativeImage.createFromPath(resolveAppIconPath())
}

export function loadTrayIconImage(): NativeImage {
    const image = loadAppIconImage()
    if (image.isEmpty()) return image
    const size = process.platform === 'darwin' ? 22 : 32
    return image.resize({width: size, height: size, quality: 'best'})
}
