/**
 * Rasterize src/assets/brand-logo.svg → build/icon.png, build/icon.ico & public/favicon.png
 * (same artwork as the Home menu AppBrandLogo).
 */
import {readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'
import toIco from 'to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = join(root, 'src/assets/brand-logo.svg')
const svg = readFileSync(svgPath)

const rasterTargets = [
    {out: join(root, 'build/icon.png'), size: 1024},
    {out: join(root, 'public/favicon.png'), size: 32},
]

for (const {out, size} of rasterTargets) {
    await sharp(svg, {density: Math.ceil((size / 32) * 72)})
        .resize(size, size)
        .png()
        .toFile(out)
    console.log(`wrote ${out} (${size}×${size})`)
}

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoBuffers = await Promise.all(
    icoSizes.map(async (size) =>
        sharp(svg, {density: Math.ceil((size / 32) * 72)})
            .resize(size, size)
            .png()
            .toBuffer(),
    ),
)
const icoPath = join(root, 'build/icon.ico')
writeFileSync(icoPath, await toIco(icoBuffers))
console.log(`wrote ${icoPath} (${icoSizes.join(', ')}px)`)
