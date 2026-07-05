import assert from 'node:assert/strict'
import {afterEach, beforeEach, describe, it, mock} from 'node:test'
import {DatawiseApiError, DatawiseClient} from '../client.js'

describe('DatawiseClient', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
        globalThis.fetch = mock.fn(async () => new Response(
            JSON.stringify({code: 0, msg: '', data: {overallStatus: 'success', tables: []}}),
            {status: 200, headers: {'Content-Type': 'application/json'}},
        )) as typeof fetch
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    it('sends API token header on migrate batch', async () => {
        const client = new DatawiseClient({server: 'http://localhost:18421', token: 'secret-token'})
        await client.migrateBatch({
            sourceConnectionId: 'src',
            targetConnectionId: 'dst',
            tables: [{tableName: 'users'}],
        })
        const call = (globalThis.fetch as ReturnType<typeof mock.fn>).mock.calls[0]
        assert.equal(call.arguments[0], 'http://localhost:18421/api/migration/batch')
        assert.equal(call.arguments[1].headers['X-DW-Api-Token'], 'secret-token')
    })

    it('throws DatawiseApiError when API returns failure code', async () => {
        globalThis.fetch = mock.fn(async () => new Response(
            JSON.stringify({code: -1, msg: 'UNAUTHORIZED', data: null}),
            {status: 401, headers: {'Content-Type': 'application/json'}},
        )) as typeof fetch
        const client = new DatawiseClient({server: 'http://localhost:18421', token: 'bad'})
        await assert.rejects(
            () => client.executeSql({sql: 'select 1', connectionId: 'c1'}),
            (error: unknown) => error instanceof DatawiseApiError && error.message === 'UNAUTHORIZED',
        )
    })
})
