import type {SshScriptRecord} from '@/features/ssh/types/ssh-script-record.types'
import {createEmptySshScriptRecord} from '@/features/ssh/types/ssh-script-record.types'
import {
    listSshScriptRecords,
    saveSshScriptRecord,
} from '@/features/ssh/services/ssh-script-records.service'

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

/** 终端纯文本输出转为脚本记录 HTML */
export function terminalOutputToRecordHtml(text: string): string {
    return `<pre>${escapeHtml(text)}</pre>`
}

export function appendTerminalOutputToRecordHtml(existingHtml: string, text: string): string {
    const block = terminalOutputToRecordHtml(text)
    const base = existingHtml?.trim()
    if (!base) return block
    return `${base}<p><br></p>${block}`
}

export function defaultTerminalSnippetTitle(now = new Date()): string {
    const stamp = now.toLocaleString(undefined, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
    return `Terminal ${stamp}`
}

export async function createScriptRecordFromTerminalSelection(
    connectionId: string,
    selection: string,
    title: string,
): Promise<SshScriptRecord> {
    const trimmed = selection.trim()
    if (!trimmed) {
        throw new Error('EMPTY_SELECTION')
    }
    const record = createEmptySshScriptRecord(`record-${Date.now()}`, title.trim())
    record.contentHtml = terminalOutputToRecordHtml(trimmed)
    return saveSshScriptRecord(connectionId, record)
}

export async function appendTerminalSelectionToScriptRecord(
    connectionId: string,
    recordId: string,
    selection: string,
): Promise<SshScriptRecord> {
    const trimmed = selection.trim()
    if (!trimmed) {
        throw new Error('EMPTY_SELECTION')
    }
    const records = await listSshScriptRecords(connectionId)
    const existing = records.find((item) => item.id === recordId)
    if (!existing) {
        throw new Error('RECORD_NOT_FOUND')
    }
    return saveSshScriptRecord(connectionId, {
        ...existing,
        contentHtml: appendTerminalOutputToRecordHtml(existing.contentHtml, trimmed),
        updatedAt: Date.now(),
    })
}
