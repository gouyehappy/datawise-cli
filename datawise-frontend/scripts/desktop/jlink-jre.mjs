/**
 * Build a trimmed JRE with jlink for desktop core profile.
 * Falls back to false when jlink is unavailable or fails.
 */
import {cpSync, existsSync, mkdirSync, renameSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {log} from './lib.mjs'

const JLINK_MODULES = [
    'java.base',
    'java.logging',
    'java.xml',
    'java.naming',
    'java.sql',
    'java.management',
    'java.instrument',
    'java.desktop',
    'jdk.crypto.ec',
    'jdk.localedata',
]

/**
 * @param {string} javaHome
 * @param {string} dest
 * @returns {boolean} true when jlink output is ready
 */
export function buildJlinkJre(javaHome, dest) {
    const jlinkBin = process.platform === 'win32'
        ? join(javaHome, 'bin', 'jlink.exe')
        : join(javaHome, 'bin', 'jlink')
    if (!existsSync(jlinkBin)) {
        log('jlink-jre', `jlink not found at ${jlinkBin}`)
        return false
    }

    const tempDest = `${dest}.jlink-tmp`
    rmSync(tempDest, {recursive: true, force: true})
    mkdirSync(tempDest, {recursive: true})

    const args = [
        `--add-modules=${JLINK_MODULES.join(',')}`,
        '--strip-debug',
        '--no-header-files',
        '--no-man-pages',
        '--compress=2',
        `--output=${tempDest}`,
    ]
    log('jlink-jre', `running jlink → ${tempDest}`)
    const result = spawnSync(jlinkBin, args, {stdio: 'inherit'})
    if (result.status !== 0) {
        rmSync(tempDest, {recursive: true, force: true})
        log('jlink-jre', 'jlink failed — caller should fall back to full JRE copy')
        return false
    }

    const javaBin = process.platform === 'win32'
        ? join(tempDest, 'bin', 'java.exe')
        : join(tempDest, 'bin', 'java')
    if (!existsSync(javaBin)) {
        rmSync(tempDest, {recursive: true, force: true})
        log('jlink-jre', `jlink output missing ${javaBin}`)
        return false
    }

    rmSync(dest, {recursive: true, force: true})
    try {
        renameSync(tempDest, dest)
    } catch {
        cpSync(tempDest, dest, {recursive: true})
        rmSync(tempDest, {recursive: true, force: true})
    }
    log('jlink-jre', `jlink JRE ready at ${dest}`)
    return true
}
