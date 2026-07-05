/** 单行可执行 SQL：trim 后空行或纯 `--` 注释行视为无可执行内容 */
export function extractExecutableLineSql(line: string): string {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (/^--/.test(trimmed)) return ''
    return trimmed
}
