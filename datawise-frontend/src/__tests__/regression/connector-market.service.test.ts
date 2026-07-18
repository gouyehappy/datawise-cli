import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
    buildConnectorInstallGuide,
    filterConnectorMarketEntries,
    formatConnectorIntegrityLabel,
    summarizeConnectorMarket,
} from '@/features/datasource/services/connector-market.service'
import type {ConnectorMarketEntry} from '@/features/datasource/types/datasource.types'

const sampleEntries: ConnectorMarketEntry[] = [
    {id: 'mysql', label: 'MySQL', primary: true, available: true, capabilities: ['SQL_EXECUTE'], integrityStatus: 'bundled'},
    {
        id: 'oracle',
        label: 'Oracle',
        primary: true,
        available: false,
        capabilities: [],
        installHint: 'Install JAR',
        version: '1.0.0',
        jarName: 'oracle.jar',
        downloadUrl: 'https://example.com/oracle.jar',
        integrityStatus: 'missing',
    },
]

describe('connector-market.service', () => {
    it('filters entries by label or id', () => {
        const filtered = filterConnectorMarketEntries(sampleEntries, 'ora')
        assert.equal(filtered.length, 1)
        assert.equal(filtered[0]?.id, 'oracle')
    })

    it('filters entries by version', () => {
        const filtered = filterConnectorMarketEntries(sampleEntries, '1.0.0')
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
        assert.match(guide, /manifest\.json/)
        assert.match(guide, /https:\/\/example\.com\/oracle\.jar/)
    })

    it('formats integrity labels', () => {
        const t = (key: string) => key
        const te = (key: string) => key.endsWith('.verified') || key.endsWith('.bundled')
        assert.equal(formatConnectorIntegrityLabel('verified', t, te), 'plugin.connectorMarket.integrity.verified')
        assert.equal(formatConnectorIntegrityLabel('none', t, te), null)
        assert.equal(formatConnectorIntegrityLabel('bundled', t, te), 'plugin.connectorMarket.integrity.bundled')
    })
})
