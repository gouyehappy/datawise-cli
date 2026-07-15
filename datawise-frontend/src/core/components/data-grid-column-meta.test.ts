import {describe, expect, it} from 'vitest'
import type {TableColumn} from '@/core/types'
import type {TableColumnDetail} from '@/shared/api/types'
import {
    isGridColumnPrimaryKey,
    isGridNumericColumn,
    resolveGridColumnTypeLabel,
} from '@/core/components/data-grid-column-meta'

describe('data-grid-column-meta', () => {
    const col = (name: string, type?: string): TableColumn => ({name, type})

    it('prefers columnDetails.dataType for type label', () => {
        const details: TableColumnDetail[] = [{
            ordinal: 1,
            name: 'price',
            dataType: 'DECIMAL(10,2)',
            nullable: false,
            autoIncrement: false,
        }]
        expect(resolveGridColumnTypeLabel(col('price', 'DOUBLE'), details)).toBe('DECIMAL(10,2)')
        expect(resolveGridColumnTypeLabel(col('price', 'DOUBLE'), [])).toBe('DOUBLE')
    })

    it('detects primary key from pkColumns or keyType', () => {
        expect(isGridColumnPrimaryKey(col('id'), ['id'], [])).toBe(true)
        expect(isGridColumnPrimaryKey(col('id'), [], [{
            ordinal: 1,
            name: 'id',
            dataType: 'INT',
            nullable: false,
            autoIncrement: true,
            keyType: 'PRI',
        }])).toBe(true)
        expect(isGridColumnPrimaryKey(col('name'), [], [])).toBe(false)
    })

    it('detects numeric types for right alignment', () => {
        expect(isGridNumericColumn(col('n', 'INT'))).toBe(true)
        expect(isGridNumericColumn(col('n', 'DECIMAL(10,2)'))).toBe(true)
        expect(isGridNumericColumn(col('n', 'VARCHAR(32)'))).toBe(false)
        expect(isGridNumericColumn(col('n', 'DATETIME(3)'))).toBe(false)
    })
})
