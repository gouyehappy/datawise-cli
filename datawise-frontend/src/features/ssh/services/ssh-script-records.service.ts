import type {SshScriptRecord} from '@/features/ssh/types/ssh-script-record.types'
import {postJson, deleteJson, getJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

export async function listSshScriptRecords(connectionId: string): Promise<SshScriptRecord[]> {
    return getJson<SshScriptRecord[]>(API_PATHS.ssh.scriptRecords(connectionId))
}

export async function saveSshScriptRecord(
    connectionId: string,
    record: SshScriptRecord,
): Promise<SshScriptRecord> {
    return postJson<SshScriptRecord>(API_PATHS.ssh.scriptRecordsSave, {
        connectionId,
        entry: {
            ...record,
            updatedAt: Date.now(),
        },
    })
}

export async function deleteSshScriptRecord(connectionId: string, recordId: string): Promise<void> {
    await deleteJson(API_PATHS.ssh.scriptRecordDelete(connectionId, recordId))
}
