import {app, nativeImage, screen} from 'electron'
import type {NativeImage} from 'electron'
import {existsSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))

function candidateIconPaths(fileName: string): string[] {
    const paths: string[] = []
    if (app.isPackaged) {
        paths.push(join(app.getAppPath(), 'build', fileName))
        paths.push(join(process.resourcesPath, 'build', fileName))
    }
    paths.push(join(moduleDir, '../build', fileName))
    paths.push(join(moduleDir, 'build', fileName))
    paths.push(join(process.cwd(), 'build', fileName))
    return paths
}

export function resolveAppIconPath(): string | null {
    for (const candidate of candidateIconPaths('icon.png')) {
        if (existsSync(candidate)) return candidate
    }
    return null
}

function resolveTrayIconPath(): string | null {
    for (const candidate of candidateIconPaths('tray-icon.png')) {
        if (existsSync(candidate)) return candidate
    }
    return resolveAppIconPath()
}

export function loadAppIconImage(): NativeImage {
    const iconPath = resolveAppIconPath()
    if (!iconPath) return nativeImage.createEmpty()
    const image = nativeImage.createFromPath(iconPath)
    return image.isEmpty() ? nativeImage.createEmpty() : image
}

function resizeToPng(source: NativeImage, size: number): Buffer {
    return source.resize({width: size, height: size, quality: 'best'}).toPNG()
}

function buildTrayIconWithRepresentations(source: NativeImage): NativeImage {
    const scale = Math.max(1, screen.getPrimaryDisplay().scaleFactor || 1)
    const tray = nativeImage.createEmpty()

    if (process.platform === 'win32') {
        const representations = [
            {scaleFactor: 1, logical: 16, pixels: 16},
            {scaleFactor: 1.25, logical: 16, pixels: 20},
            {scaleFactor: 1.5, logical: 16, pixels: 24},
            {scaleFactor: 2, logical: 16, pixels: 32},
        ]

        for (const entry of representations) {
            tray.addRepresentation({
                scaleFactor: entry.scaleFactor,
                width: entry.logical,
                height: entry.logical,
                buffer: resizeToPng(source, entry.pixels),
            })
        }
        return tray
    }

    const logicalSize = process.platform === 'darwin' ? 22 : 24
    const pixelSize = Math.round(logicalSize * scale)
    return source.resize({width: pixelSize, height: pixelSize, quality: 'best'})
}

export function loadTrayIconImage(): NativeImage {
    const iconPath = resolveTrayIconPath()
    if (!iconPath) return nativeImage.createEmpty()

    const source = nativeImage.createFromPath(iconPath)
    if (source.isEmpty()) return source

    return buildTrayIconWithRepresentations(source)
}
