/**
 * Windows：signAndEditExecutable=false 时 electron-builder 不会把图标写入 exe，
 * 在 afterPack 阶段用 rcedit 手动嵌入 build/icon.ico。
 */
const path = require('node:path')

/** @param {import('app-builder-lib').AfterPackContext} context */
module.exports = async function embedWinIcon(context) {
    if (context.electronPlatformName !== 'win32') return

    const productName = context.packager.appInfo.productFilename
    const exePath = path.join(context.appOutDir, `${productName}.exe`)
    const iconPath = path.join(__dirname, '..', 'build', 'icon.ico')

    const {rcedit} = await import('rcedit')
    await rcedit(exePath, {icon: iconPath})
    console.log(`[embed-win-icon] ${iconPath} -> ${exePath}`)
}
