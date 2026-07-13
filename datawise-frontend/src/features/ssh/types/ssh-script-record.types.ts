export interface SshScriptRecord {
    id: string
    title: string
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
