import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.join(__dirname, '../src/i18n/locales')

const TOP_LEVEL_KEY = /^  (\w+): \{/

/** 保留字模块名 → 安全 import 变量名 */
const IMPORT_ALIASES = {
    console: 'consoleLocale',
}

function splitLocale(sourceFile, localeName) {
    let lines = fs.readFileSync(sourceFile, 'utf8').split('\n')
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()

    const outDir = path.join(localesDir, localeName)
    fs.rmSync(outDir, {recursive: true, force: true})
    fs.mkdirSync(outDir, {recursive: true})

    const keys = []
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(TOP_LEVEL_KEY)
        if (match) keys.push({key: match[1], start: i})
    }

    for (let i = 0; i < keys.length; i++) {
        const {key, start} = keys[i]
        const end = i + 1 < keys.length ? keys[i + 1].start - 1 : lines.length - 2
        const blockLines = lines.slice(start, end + 1)
        const innerLines = blockLines.slice(1, -1)
        fs.writeFileSync(
            path.join(outDir, `${key}.ts`),
            ['export default {', ...innerLines, '}', ''].join('\n'),
            'utf8',
        )
    }

    const imports = keys
        .map(({key}) => {
            const alias = IMPORT_ALIASES[key] ?? key
            return `import ${alias} from './${key}'`
        })
        .join('\n')

    const exports = keys
        .map(({key}) => {
            const alias = IMPORT_ALIASES[key] ?? key
            const exportKey = key
            return alias === exportKey ? `  ${exportKey},` : `  ${exportKey}: ${alias},`
        })
        .join('\n')

    fs.writeFileSync(path.join(outDir, 'index.ts'), `${imports}\n\nexport default {\n${exports}\n}\n`, 'utf8')
}

splitLocale(path.join(localesDir, 'zh-CN.ts'), 'zh-CN')
splitLocale(path.join(localesDir, 'en-US.ts'), 'en-US')

console.log('Split locales into zh-CN/ and en-US/')
