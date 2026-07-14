export interface SshScriptRecord {
    id: string
    title: string
    /** Legacy field name — stores plain command text (older records may still be HTML). */
    contentHtml: string
    updatedAt: number
}

export function createEmptySshScriptRecord(id: string, title: string): SshScriptRecord {
    return {
        id,
        title,
        contentHtml: '',
        updatedAt: Date.now(),
    }
}
