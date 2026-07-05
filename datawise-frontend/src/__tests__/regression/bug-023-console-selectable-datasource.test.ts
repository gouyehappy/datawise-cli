import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import type {DataSourceOption} from '@/core/types'
import {
    filterSelectableDataSources,
    isDataSourceSelectable,
    pickDefaultDataSource,
} from '@/features/explorer/utils/data-sources.ts'

const sources: DataSourceOption[] = [
    {
        id: 'conn-ok',
        label: '10.15.34.141',
        dbType: 'mysql',
        instances: [{id: 'db-1', label: 'admin_db'}],
    },
    {
        id: 'conn-error',
        label: 'docker-mysql',
        dbType: 'mysql',
        instances: [],
    },
    {
        id: 'conn-unknown',
        label: 'legacy',
        dbType: 'mysql',
        instances: [{id: 'db-2', label: 'legacy_db'}],
    },
]

describe('selectable console data sources', () => {
    const health = {
        'conn-ok': 'ok',
        'conn-error': 'error',
    } as const

    it('excludes connections with probe error', () => {
        assert.equal(isDataSourceSelectable(sources[1], health), false)
        assert.deepEqual(
            filterSelectableDataSources(sources, health).map((item) => item.id),
            ['conn-ok', 'conn-unknown'],
        )
    })

    it('picks first connectable source for new console', () => {
        assert.equal(pickDefaultDataSource(sources, health)?.id, 'conn-ok')
        assert.equal(pickDefaultDataSource(sources, health, 'conn-unknown')?.id, 'conn-unknown')
        assert.equal(
            pickDefaultDataSource(sources, health, 'conn-error')?.id,
            'conn-ok',
        )
    })
})
