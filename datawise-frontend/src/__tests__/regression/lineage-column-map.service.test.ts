import {describe, expect, it} from 'vitest'
import {
    buildColumnLineageMap,
    hasColumnLineage,
    layoutColumnLineageMap,
} from '@/features/lineage/services/lineage-column-map.service'
import type {LineageGraph} from '@/features/lineage/types/lineage.types'

function sampleGraph(): LineageGraph {
    return {
        root: {id: 'model:orders_summary', label: 'orders_summary', kind: 'model'},
        columnMappings: [
            {
                outputColumn: 'order_id',
                sources: [{
                    schema: null,
                    table: 'orders',
                    column: 'id',
                    qualifiedName: 'orders.id',
                    kind: 'physical_table',
                }],
                expression: null,
            },
            {
                outputColumn: 'full_name',
                sources: [
                    {
                        schema: null,
                        table: 'users',
                        column: 'first_name',
                        qualifiedName: 'users.first_name',
                        kind: 'physical_table',
                    },
                    {
                        schema: null,
                        table: 'users',
                        column: 'last_name',
                        qualifiedName: 'users.last_name',
                        kind: 'physical_table',
                    },
                ],
                expression: 'CONCAT(first_name, last_name)',
            },
        ],
        nodes: [],
        edges: [],
        meta: {
            sqlHash: 'abc',
            parsedAt: '2026-01-01',
            dialect: 'mysql',
            parser: 'jsqlparser',
            parserVersion: '5.3',
            depth: 3,
            status: 'complete',
            warnings: [],
        },
    }
}

describe('lineage-column-map.service', () => {
    it('builds output to source mappings', () => {
        const map = buildColumnLineageMap(sampleGraph())
        expect(map).not.toBeNull()
        expect(hasColumnLineage(map)).toBe(true)
        expect(map?.outputs).toHaveLength(2)

        const orderId = map?.outputs.find((row) => row.column === 'order_id')
        expect(orderId?.sources).toHaveLength(1)
        expect(orderId?.sources[0].qualifiedName).toBe('orders.id')

        const fullName = map?.outputs.find((row) => row.column === 'full_name')
        expect(fullName?.sources).toHaveLength(2)
        expect(fullName?.transform).toContain('CONCAT')
    })

    it('lays out ER entities with field links and expression labels', () => {
        const map = buildColumnLineageMap(sampleGraph())
        const layout = layoutColumnLineageMap(map)
        expect(layout?.entities.some((entity) => entity.side === 'source')).toBe(true)
        expect(layout?.entities.some((entity) => entity.side === 'output')).toBe(true)
        expect(layout?.links.length).toBeGreaterThan(0)
        expect(layout?.links.every((link) => link.path.startsWith('M '))).toBe(true)

        const transformLink = layout?.links.find((link) => link.transform)
        expect(transformLink?.expression).toContain('CONCAT')

        const labelLink = layout?.links.find((link) => link.showExpression)
        expect(labelLink?.labelLines[0]).toContain('CONCAT')
        expect(labelLink?.labelX).toBeGreaterThan(0)
    })
})
