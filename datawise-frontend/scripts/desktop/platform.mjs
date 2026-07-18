/**
 * Resolve electron-builder CLI args from host platform + flags.
 * Exported for unit tests.
 */

/**
 * @param {{
 *   dir?: boolean
 *   win?: boolean
 *   mac?: boolean
 *   linux?: boolean
 *   arm64?: boolean
 *   x64?: boolean
 *   platform?: NodeJS.Platform
 *   allowCross?: boolean
 * }} opts
 * @returns {string[]}
 */
export function resolveElectronBuilderArgs(opts = {}) {
    const platform = opts.platform ?? process.platform
    const allowCross = opts.allowCross === true
        || process.env.DATAWISE_ALLOW_CROSS_PACKAGING === '1'

    const selected = []
    if (opts.win) selected.push('win')
    if (opts.mac) selected.push('mac')
    if (opts.linux) selected.push('linux')

    if (selected.length === 0) {
        if (platform === 'darwin') selected.push('mac')
        else if (platform === 'linux') selected.push('linux')
        else selected.push('win')
    }

    if (!allowCross) {
        for (const target of selected) {
            if (target === 'mac' && platform !== 'darwin') {
                throw new Error(
                    'Building macOS desktop packages requires macOS (Apple Silicon recommended). '
                    + 'Run on a Mac runner, or set DATAWISE_ALLOW_CROSS_PACKAGING=1 to override.',
                )
            }
            if (target === 'win' && platform === 'darwin') {
                // Windows targets can be produced on Mac with wine in some setups; keep allowed.
                continue
            }
        }
    }

    const args = selected.map((name) => `--${name}`)
    if (opts.dir) args.push('--dir')
    if (opts.arm64) args.push('--arm64')
    if (opts.x64) args.push('--x64')

    // Apple Silicon default when building mac on arm64 host and arch not specified.
    if (selected.includes('mac') && !opts.arm64 && !opts.x64 && platform === 'darwin' && process.arch === 'arm64') {
        args.push('--arm64')
    }

    return args
}

/**
 * Human-readable packaging target label for logs / docs.
 * @param {string[]} builderArgs
 */
export function describeDesktopTarget(builderArgs) {
    const platforms = builderArgs.filter((a) => a.startsWith('--') && ['--win', '--mac', '--linux'].includes(a))
        .map((a) => a.slice(2))
    const arch = builderArgs.includes('--arm64')
        ? 'arm64'
        : builderArgs.includes('--x64')
            ? 'x64'
            : 'default'
    const mode = builderArgs.includes('--dir') ? 'unpacked' : 'installer'
    return `${platforms.join('+') || 'host'} ${arch} (${mode})`
}
