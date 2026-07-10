/**
 * Rasterize brand SVGs → build/* & public/* at maximum practical resolution.
 */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'
import toIco from 'to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const brandLogoSvg = readFileSync(join(root, 'src/assets/brand-logo.svg'))
const brandTraySvg = readFileSync(join(root, 'src/assets/brand-tray.svg'))

/** Master PNG for Electron / electron-builder (Windows scales down from this). */
const MASTER_ICON_SIZE = 4096

/** SVG render density — higher = sharper small-size downscales. */
function svgDensity(targetPx) {
    return Math.max(512, Math.ceil((targetPx / 32) * 144))
}

async function renderPng(svg, size, {supersample = false} = {}) {
    const renderPx = supersample && size <= 128 ? size * 2 : size
    let pipeline = sharp(svg, {density: svgDensity(renderPx)}).resize(renderPx, renderPx, {
        kernel: sharp.kernel.lanczos3,
        fit: 'fill',
    })
    if (renderPx !== size) {
        pipeline = pipeline.resize(size, size, {kernel: sharp.kernel.lanczos3, fit: 'fill'})
    }
    return pipeline
        .png({compressionLevel: 9, effort: 10, palette: false})
        .toBuffer()
}

async function writePng(svg, out, size, options = {}) {
    mkdirSync(dirname(out), {recursive: true})
    const buffer = await renderPng(svg, size, options)
    writeFileSync(out, buffer)
    console.log(`wrote ${out} (${size}×${size})`)
    return buffer
}

const buildTargets = [
    {svg: brandLogoSvg, out: join(root, 'build/icon.png'), size: MASTER_ICON_SIZE},
    {svg: brandLogoSvg, out: join(root, 'dist-electron/build/icon.png'), size: MASTER_ICON_SIZE},
    {svg: brandTraySvg, out: join(root, 'build/tray-icon.png'), size: 256, supersample: true},
    {svg: brandTraySvg, out: join(root, 'dist-electron/build/tray-icon.png'), size: 256, supersample: true},
]

const publicTargets = [
    {svg: brandLogoSvg, out: join(root, 'public/favicon-16.png'), size: 16, supersample: true},
    {svg: brandLogoSvg, out: join(root, 'public/favicon-32.png'), size: 32, supersample: true},
    {svg: brandLogoSvg, out: join(root, 'public/favicon-48.png'), size: 48, supersample: true},
    {svg: brandLogoSvg, out: join(root, 'public/favicon-64.png'), size: 64, supersample: true},
    {svg: brandLogoSvg, out: join(root, 'public/favicon-128.png'), size: 128},
    {svg: brandLogoSvg, out: join(root, 'public/favicon-256.png'), size: 256},
    {svg: brandLogoSvg, out: join(root, 'public/favicon.png'), size: 128},
    {svg: brandLogoSvg, out: join(root, 'public/apple-touch-icon.png'), size: 180},
    {svg: brandLogoSvg, out: join(root, 'public/icon-192.png'), size: 192},
    {svg: brandLogoSvg, out: join(root, 'public/icon-512.png'), size: 512},
]

for (const target of buildTargets) {
    await writePng(target.svg, target.out, target.size, {supersample: target.supersample})
}

for (const target of publicTargets) {
    await writePng(target.svg, target.out, target.size, {supersample: target.supersample})
}

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoBuffers = await Promise.all(
    icoSizes.map(async (size) => renderPng(brandLogoSvg, size, {supersample: size <= 48})),
)
const icoPath = join(root, 'build/icon.ico')
writeFileSync(icoPath, await toIco(icoBuffers))
console.log(`wrote ${icoPath} (${icoSizes.join(', ')}px)`)
