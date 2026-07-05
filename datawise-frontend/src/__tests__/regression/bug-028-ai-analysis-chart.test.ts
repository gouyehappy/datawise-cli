import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {buildAiChartOption} from '@/features/ai/analysis/services/ai-chart.service'
import type {AiChartSpec} from '@/features/ai/types/analysis'

describe('ai-chart.service', () => {
    it('builds line chart option from analysis result', () => {
        const chart: AiChartSpec = {
            type: 'line',
            title: 'Sales trend',
            xField: 'month',
            yFields: ['total_sales'],
            seriesNames: ['total_sales'],
        }
        const option = buildAiChartOption(
            chart,
            [
                {name: 'month', key: 'month'},
                {name: 'total_sales', key: 'total_sales'},
            ],
            [
                {month: '2026-01', total_sales: 120},
                {month: '2026-02', total_sales: 156},
            ],
        )

        assert.ok(option)
        assert.equal((option as { series?: Array<{ type?: string }> }).series?.[0]?.type, 'line')
    })
})
