import {matchesKeywordPrefix} from './filter-text'

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 行尾是否已完整输入该关键字（仅尾部空白） */
export function isKeywordCompleteBeforeCursor(lineBefore: string, keyword: string): boolean {
    const trimmed = lineBefore.trimEnd()
    if (!trimmed || !keyword.trim()) return false
    const parts = keyword.trim().split(/\s+/)
    const pattern = parts.map(escapeRegex).join('\\s+')
    const re = new RegExp(`(?:^|\\s)(${pattern})(?=\\s|$)`, 'gi')

    let lastMatch: RegExpExecArray | null = null
    let m: RegExpExecArray | null
    while ((m = re.exec(trimmed)) !== null) {
        lastMatch = m
    }
    if (!lastMatch) return false

    const afterKeyword = trimmed.slice(lastMatch.index! + lastMatch[0].length).trimStart()
    if (!afterKeyword) return true

    const firstWord = parts[0] ?? ''
    const nextToken = afterKeyword.split(/\s+/)[0] ?? ''
    const stillTypingKeyword = new RegExp(`^${escapeRegex(firstWord)}\\w*$`, 'i').test(nextToken)
    return !stillTypingKeyword
}

/** 是否仍应提供该关键字补全（排除已完整输入的重复项） */
export function shouldOfferKeywordAtCursor(
    lineBefore: string,
    keyword: string,
    prefix: string,
): boolean {
    if (!matchesKeywordPrefix(keyword, prefix)) return false
    if (isKeywordCompleteBeforeCursor(lineBefore, keyword)) return false
    return true
}

/** 行尾是否为已完整的 FROM（下一步应接表名） */
export function lineEndsWithCompleteFrom(lineBefore: string): boolean {
    return /\bFROM\s*$/i.test(lineBefore.trimEnd())
}
