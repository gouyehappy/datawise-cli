import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {
    buildSshConnectionFeatureChildren,
    ensureSshConnectionFeatureChildren,
    parseSshScriptRecordId,
    sshScriptRecordNodeId,
} from '@/features/explorer/services/ssh-feature-tree.service'

describe('ssh-feature-tree.service', () => {
    it('builds terminal and script-records children', () => {
        const children = buildSshConnectionFeatureChildren('ssh-1')
        assert.equal(children.length, 2)
        assert.equal(children[0]?.type, 'ssh-terminal')
        assert.equal(children[1]?.type, 'ssh-script-records')
    })

    it('injects ssh children once', () => {
        const connection = {
            id: 'ssh-1',
            label: 'SSH@host',
            type: 'connection' as const,
            dbType: 'ssh' as const,
        }
        ensureSshConnectionFeatureChildren(connection)
        assert.equal(connection.children?.length, 2)
        ensureSshConnectionFeatureChildren(connection)
        assert.equal(connection.children?.length, 2)
    })

    it('parses script record id from node', () => {
        const nodeId = sshScriptRecordNodeId('ssh-1', 'record-1')
        assert.equal(parseSshScriptRecordId({type: 'ssh-script-record', id: nodeId}), 'record-1')
    })
})
