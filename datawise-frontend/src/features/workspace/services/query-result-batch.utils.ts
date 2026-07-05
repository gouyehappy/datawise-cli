import type {QueryResultBatchEntry, QueryResultItem} from '@/features/workspace/types'

/** 无结果集的成功语句（DDL / DML 等） */
export function isNonGridResult(item: QueryResultItem): boolean {
    if (item.batchEntries?.length) return false
    if (item.status === 'error') return true
    return !(item.columns?.length)
}

/** 多条无结果集语句合并为单个摘要 Tab */
export function shouldCollapseBatchResults(items: QueryResultItem[]): boolean {
    return items.length > 1 && items.every(isNonGridResult)
}

export interface BatchSummaryLabels {
    summaryLabel: string
    resultTabLabel: (index: number, item: QueryResultItem) => string
}

export function buildCollapsedBatchSummary(
    items: QueryResultItem[],
    labels: BatchSummaryLabels,
): QueryResultItem[] {
    const totalDuration = items.reduce((sum, item) => sum + item.durationMs, 0)
    const totalRows = items.reduce((sum, item) => sum + item.total, 0)
    const failed = items.find((item) => item.status === 'error')

    const batchEntries: QueryResultBatchEntry[] = items.map((item, index) => ({
        label: labels.resultTabLabel(index, item),
        sql: item.sql,
        status: item.status,
        durationMs: item.durationMs,
        total: item.total,
        errorMessage: item.errorMessage,
        errorLine: item.errorLine,
    }))

    return [
        {
            id: `batch-${Date.now()}`,
            label: labels.summaryLabel,
            sql: items.map((item) => item.sql).join('\n'),
            columns: [],
            rows: [],
            total: totalRows,
            durationMs: totalDuration,
            status: failed ? 'error' : 'success',
            errorMessage: failed?.errorMessage,
            errorLine: failed?.errorLine,
            batchEntries,
            batchRunning: false,
        },
    ]
}

export function createStreamingBatchSummary(
    totalStatements: number,
    batchId: string,
    labels: BatchSummaryLabels,
): QueryResultItem {
    return {
        id: batchId,
        label: labels.summaryLabel,
        sql: '',
        columns: [],
        rows: [],
        total: 0,
        durationMs: 0,
        status: 'success',
        batchEntries: [],
        batchRunning: true,
        batchTotal: totalStatements,
    }
}

export function appendStreamingBatchSummary(
    summary: QueryResultItem,
    item: QueryResultItem,
    index: number,
    labels: BatchSummaryLabels,
): QueryResultItem {
    const entry: QueryResultBatchEntry = {
        label: labels.resultTabLabel(index, item),
        sql: item.sql,
        status: item.status,
        durationMs: item.durationMs,
        total: item.total,
        errorMessage: item.errorMessage,
        errorLine: item.errorLine,
    }
    const batchEntries = [...(summary.batchEntries ?? []), entry]
    const totalDuration = batchEntries.reduce((sum, row) => sum + row.durationMs, 0)
    const totalRows = batchEntries.reduce((sum, row) => sum + row.total, 0)
    const failed = batchEntries.find((row) => row.status === 'error')

    return {
        ...summary,
        batchEntries,
        total: totalRows,
        durationMs: totalDuration,
        sql: batchEntries.map((row) => row.sql).join('\n'),
        label: labels.summaryLabel,
        status: failed ? 'error' : 'success',
        errorMessage: failed?.errorMessage,
        errorLine: failed?.errorLine,
    }
}

export function finishStreamingBatchSummary(
    summary: QueryResultItem,
    summaryLabel: string,
): QueryResultItem {
    return {
        ...summary,
        batchRunning: false,
        label: summaryLabel,
    }
}
