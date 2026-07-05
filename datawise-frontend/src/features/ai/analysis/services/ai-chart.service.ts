import type {EChartsOption} from 'echarts'
import type {AiChartSpec} from '@/features/ai/types/analysis'
import type {TableColumn, TableRow} from '@/core/types'

function columnKey(column: TableColumn): string {
    return column.key ?? column.name
}

function readCell(row: TableRow, key: string): string | number | null {
    const value = row[key]
    if (value === null || value === undefined) return null
    if (typeof value === 'number') return value
    const text = String(value).trim()
    if (!text) return null
    const numeric = Number(text)
    return Number.isFinite(numeric) && text !== '' ? numeric : text
}

function readCategories(rows: TableRow[], xField: string): string[] {
    return rows.map((row) => {
        const value = readCell(row, xField)
        return value == null ? '' : String(value)
    })
}

/** 将后端 chart spec + 查询结果转为 ECharts option */
export function buildAiChartOption(
    chart: AiChartSpec,
    columns: TableColumn[],
    rows: TableRow[],
): EChartsOption | null {
    if (!rows.length || !chart.yFields.length) return null

    const xField = chart.xField
    const categories = readCategories(rows, xField)

    if (chart.type === 'pie' && chart.yFields.length === 1) {
        const yField = chart.yFields[0]
        return {
            title: {text: chart.title, left: 'center', textStyle: {fontSize: 13}},
            tooltip: {trigger: 'item'},
            series: [
                {
                    type: 'pie',
                    radius: ['36%', '68%'],
                    data: rows.map((row) => ({
                        name: String(readCell(row, xField) ?? ''),
                        value: Number(readCell(row, yField) ?? 0),
                    })),
                },
            ],
        }
    }

    const series = chart.yFields.map((field, index) => ({
        name: chart.seriesNames[index] ?? columns.find((col) => columnKey(col) === field)?.name ?? field,
        type: chart.type,
        smooth: chart.type === 'line',
        data: rows.map((row) => Number(readCell(row, field) ?? 0)),
    }))

    return {
        title: {text: chart.title, left: 'center', textStyle: {fontSize: 13}},
        tooltip: {trigger: 'axis'},
        legend: series.length > 1 ? {top: 28} : undefined,
        grid: {left: 48, right: 24, top: series.length > 1 ? 64 : 48, bottom: 40},
        xAxis: {
            type: 'category',
            data: categories,
            axisLabel: {rotate: categories.some((item) => item.length > 8) ? 30 : 0},
        },
        yAxis: {type: 'value'},
        series,
    }
}

export function normalizeChartSpec(
    chart: Record<string, unknown> | null | undefined,
): AiChartSpec | null {
    if (!chart || typeof chart.type !== 'string') return null
    const type = chart.type
    if (type !== 'bar' && type !== 'line' && type !== 'pie') return null
    return {
        type,
        title: String(chart.title ?? ''),
        xField: String(chart.xField ?? ''),
        yFields: Array.isArray(chart.yFields) ? chart.yFields.map(String) : [],
        seriesNames: Array.isArray(chart.seriesNames) ? chart.seriesNames.map(String) : [],
    }
}

export function normalizeAnalysisColumns(
    columns: Array<Record<string, unknown>> | undefined,
): TableColumn[] {
    if (!columns?.length) return []
    return columns.map((column) => ({
        name: String(column.name ?? ''),
        key: column.key != null ? String(column.key) : String(column.name ?? ''),
        type: column.type != null ? String(column.type) : undefined,
    }))
}

export function normalizeAnalysisRows(
    rows: Array<Record<string, unknown>> | undefined,
): TableRow[] {
    if (!rows?.length) return []
    return rows.map((row) => {
        const normalized: TableRow = {}
        for (const [key, value] of Object.entries(row)) {
            if (value === null || value === undefined) {
                normalized[key] = null
            } else if (typeof value === 'number') {
                normalized[key] = value
            } else {
                normalized[key] = String(value)
            }
        }
        return normalized
    })
}
