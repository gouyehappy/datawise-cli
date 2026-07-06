import {describe, expect, it} from 'vitest'
import {
    buildParameterValueMap,
    extractCanvasParameters,
} from '@/features/platform/services/analysis-canvas-parameters.service'

describe('analysis-canvas-parameters.service', () => {
    it('extracts unique parameter keys from templates', () => {
        const params = extractCanvasParameters(
            'Sales from {{start_date}} to {{end_date}}',
            'WHERE store_id = {{store_id}} AND dt >= {{start_date}}',
        )
        expect(params.map((item) => item.key).sort()).toEqual(['end_date', 'start_date', 'store_id'])
    })

    it('merges defaults with overrides', () => {
        const map = buildParameterValueMap(
            [{key: 'store_id', defaultValue: '1'}],
            {store_id: '42'},
        )
        expect(map.store_id).toBe('42')
    })
})
