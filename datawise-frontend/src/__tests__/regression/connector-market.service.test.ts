import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
    buildConnectorInstallGuide,
    filterConnectorMarketEntries,
    summarizeConnectorMarket,
} from '@/features/datasource/services/connector-market.service'
import type {ConnectorMarketEntry} from '@/features/datasource/types/datasource.types'

const sampleEntries: ConnectorMarketEntry[] = [
    {id: 'mysql', label: 'MySQL', primary: true, available: true, capabilities: ['SQL_EXECUTE']},
    {id: 'oracle', label: 'Oracle', primary: true, available: false, capabilities: [], installHint: 'Install JAR'},
]

describe('connector-market.service', () => {
    it('filters entries by label or id', () => {
        const filtered = filterConnectorMarketEntries(sampleEntries, 'ora')
        assert.equal(filtered.length, 1)
        assert.equal(filtered[0]?.id, 'oracle')
    })

    it('summarizes available and pending connectors', () => {
        const summary = summarizeConnectorMarket(sampleEntries)
        assert.equal(summary.total, 2)
        assert.equal(summary.available, 1)
        assert.equal(summary.pending, 1)
    })

    it('builds install guide text for pending connectors', () => {
        const guide = buildConnectorInstallGuide(sampleEntries[1]!)
        assert.match(guide, /Oracle/)
        assert.match(guide, /config\/plugins/)
        assert.match(guide, /Install JAR/)
    })
})
