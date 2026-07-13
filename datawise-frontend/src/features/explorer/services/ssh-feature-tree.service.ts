import type {TreeNode} from '@/core/types'
import {listSshScriptRecords} from '@/features/ssh/services/ssh-script-records.service'

export const SSH_SCRIPT_RECORDS_NODE_SUFFIX = ':ssh:script-records'

export function sshScriptRecordsNodeId(connectionId: string): string {
    return `${connectionId}${SSH_SCRIPT_RECORDS_NODE_SUFFIX}`
}

export function parseSshScriptRecordsConnectionId(nodeId: string): string | null {
    if (!nodeId.endsWith(SSH_SCRIPT_RECORDS_NODE_SUFFIX)) return null
    return nodeId.slice(0, -SSH_SCRIPT_RECORDS_NODE_SUFFIX.length) || null
}

export function sshScriptRecordNodeId(connectionId: string, recordId: string): string {
    return `${connectionId}:ssh:script-record:${recordId}`
}

export function parseSshScriptRecordId(node: Pick<TreeNode, 'type' | 'id'>): string | null {
    if (node.type !== 'ssh-script-record') return null
    const marker = ':ssh:script-record:'
    const index = node.id.lastIndexOf(marker)
    if (index < 0) return null
    return node.id.slice(index + marker.length) || null
}

export function buildSshConnectionFeatureChildren(connectionId: string): TreeNode[] {
    return [
        {
            id: `${connectionId}:ssh-terminal`,
            label: 'terminal',
            type: 'ssh-terminal',
            dbType: 'ssh',
            meta: 'terminal',
        },
        {
            id: sshScriptRecordsNodeId(connectionId),
            label: 'script-records',
            type: 'ssh-script-records',
            dbType: 'ssh',
            meta: 'script-records',
        },
    ]
}

export function ensureSshConnectionFeatureChildren(node: TreeNode): void {
    if (node.type !== 'connection' || node.dbType !== 'ssh') return
    const expected = buildSshConnectionFeatureChildren(node.id)
    if (!node.children?.length) {
        node.children = expected
        return
    }
    const existingTypes = new Set(node.children.map((child) => child.type))
    for (const child of expected) {
        if (!existingTypes.has(child.type)) {
            node.children.push(child)
        }
    }
}

export function buildSshScriptRecordNodes(
    connectionId: string,
    records: Array<{id: string; title: string}>,
): TreeNode[] {
    return records.map((record) => ({
        id: sshScriptRecordNodeId(connectionId, record.id),
        label: record.title,
        type: 'ssh-script-record' as const,
        dbType: 'ssh' as const,
        meta: record.id,
    }))
}

export async function refreshSshScriptRecordChildren(node: TreeNode, connectionId: string): Promise<void> {
    const records = await listSshScriptRecords(connectionId)
    node.children = buildSshScriptRecordNodes(connectionId, records)
    node.meta = 'loaded'
    node.childCount = node.children.length
}
