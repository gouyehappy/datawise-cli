import {htmlToPlainText} from '@/features/ssh/services/ssh-html-text.service'
import type {SshScriptRecord} from '@/features/ssh/types/ssh-script-record.types'

export type MyCommandMode = 'run' | 'paste'

export interface MyCommandEntry {
    label: string
    command: string
    mode?: MyCommandMode
}

export interface MyCommandGroup {
    id: string
    title: string
    entries: MyCommandEntry[]
    multi: boolean
    mode: MyCommandMode
    builtIn: boolean
    pinned: boolean
}

const LABEL_LINE = /^#\s*(.+?)(?:\s+!(run|paste))?\s*$/
const MODE_LINE = /^@(run|paste)\s*$/i
export const SSH_BUILTIN_RECORD_PREFIX = 'builtin-'

export function isBuiltInScriptRecordId(recordId: string): boolean {
    return recordId.startsWith(SSH_BUILTIN_RECORD_PREFIX)
}

export function splitCommandLines(text: string): string[] {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
}

function resolveEntryMode(
    entryMode: MyCommandMode | undefined,
    groupMode: MyCommandMode,
): MyCommandMode {
    return entryMode ?? groupMode
}

/** 解析快捷命令：`@run`/`@paste` 控制行为；`# 标题 !run` 可覆盖单条 */
export function parseCommandEntries(text: string, defaultMode: MyCommandMode = 'paste'): {
    mode: MyCommandMode
    entries: MyCommandEntry[]
} {
    let groupMode = defaultMode
    const entries: MyCommandEntry[] = []
    let pendingLabel: string | null = null
    let pendingEntryMode: MyCommandMode | undefined

    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim()
        if (!line) continue

        const modeMatch = line.match(MODE_LINE)
        if (modeMatch) {
            groupMode = modeMatch[1]!.toLowerCase() as MyCommandMode
            continue
        }

        const labelMatch = line.match(LABEL_LINE)
        if (labelMatch) {
            pendingLabel = labelMatch[1]!.trim()
            pendingEntryMode = labelMatch[2]?.toLowerCase() as MyCommandMode | undefined
            continue
        }

        entries.push({
            label: pendingLabel || summarizeCommandLabel(line),
            command: line,
            mode: pendingEntryMode,
        })
        pendingLabel = null
        pendingEntryMode = undefined
    }

    return {mode: groupMode, entries}
}

export function parseMyCommandGroups(
    records: SshScriptRecord[],
    untitledLabel: string,
    pinnedIds: string[] = [],
): MyCommandGroup[] {
    const pinnedSet = new Set(pinnedIds)
    const groups: MyCommandGroup[] = []
    for (const record of records) {
        const parsed = parseCommandEntries(htmlToPlainText(record.contentHtml ?? ''))
        if (!parsed.entries.length) continue
        groups.push({
            id: record.id,
            title: record.title?.trim() || untitledLabel,
            entries: parsed.entries.map((entry) => ({
                ...entry,
                mode: resolveEntryMode(entry.mode, parsed.mode),
            })),
            multi: parsed.entries.length > 1,
            mode: parsed.mode,
            builtIn: isBuiltInScriptRecordId(record.id),
            pinned: pinnedSet.has(record.id),
        })
    }
    return sortMyCommandGroups(groups)
}

export function sortMyCommandGroups(groups: MyCommandGroup[]): MyCommandGroup[] {
    return [...groups].sort((left, right) => {
        if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
        if (left.builtIn !== right.builtIn) return left.builtIn ? -1 : 1
        return left.title.localeCompare(right.title, undefined, {sensitivity: 'base'})
    })
}

export function filterMyCommandGroups(groups: MyCommandGroup[], query: string): MyCommandGroup[] {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return groups

    return groups.flatMap((group) => {
        if (group.title.toLowerCase().includes(normalized)) return [group]

        const matchedEntries = group.entries.filter((entry) =>
            entry.label.toLowerCase().includes(normalized)
            || entry.command.toLowerCase().includes(normalized),
        )
        if (!matchedEntries.length) return []

        return [{
            ...group,
            entries: matchedEntries,
            multi: matchedEntries.length > 1,
        }]
    })
}

export function summarizeCommandLabel(command: string, maxLength = 48): string {
    const compact = command.replace(/\s+/g, ' ').trim()
    if (compact.length <= maxLength) return compact
    return `${compact.slice(0, maxLength - 1)}…`
}

export function resolveEntryAction(entry: MyCommandEntry, group: MyCommandGroup): MyCommandMode {
    return resolveEntryMode(entry.mode, group.mode)
}
