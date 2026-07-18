import {describe, expect, it} from 'vitest'
import {isResultTruncatedAtCap} from '@/features/workspace/services/query-result-truncation'

describe('isResultTruncatedAtCap', () => {
    it('is true for hasMore without cursor', () => {
        expect(isResultTruncatedAtCap({hasMore: true})).toBe(true)
        expect(isResultTruncatedAtCap({hasMore: true, cursorId: ''})).toBe(true)
    })

    it('is false when cursor can load more or not truncated', () => {
        expect(isResultTruncatedAtCap({hasMore: true, cursorId: 'c1'})).toBe(false)
        expect(isResultTruncatedAtCap({hasMore: false})).toBe(false)
        expect(isResultTruncatedAtCap(null)).toBe(false)
    })
})
