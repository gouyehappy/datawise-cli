import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {nextScriptFileName} from '../../features/explorer/services/sql-script-naming.ts'

describe('nextScriptFileName', () => {
    it('starts at Script-1 when no scripts exist', () => {
        assert.equal(nextScriptFileName([]), 'Script-1.sql')
    })

    it('increments from highest Script-N', () => {
        assert.equal(
            nextScriptFileName([
                {fileName: 'Script-1.sql'},
                {fileName: 'Script-2.sql'},
                {fileName: 'burying_business.sql'},
            ]),
            'Script-3.sql',
        )
    })
})
