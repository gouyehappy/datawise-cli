import {formatCellFullValue, type TableCellValue} from '@/core/utils/cell-value-format'
import type {TableColumn, TableRow} from '@/core/types'
import {columnRowKey, readRowCell, readRowCellScalar} from '@/core/utils/query-result-column'
import {serializeGridToXlsxBuffer} from '@/features/workspace/services/grid-xlsx.service'
import {
    applyExportMasking,
    type GridExportMaskConfig,
} from '@/features/workspace/services/data-masking.service'

export type GridExportFormat = 'csv' | 'json' | 'tsv' | 'sql' | 'xlsx'

export interface GridExportOptions {
    mask?: GridExportMaskConfig
}

const FORMAT_EXT: Record<GridExportFormat, string> = {
    csv: 'csv',
    json: 'json',
    tsv: 'tsv',
    sql: 'sql',
    xlsx: 'xlsx',
}

const FORMAT_MIME: Record<GridExportFormat, string> = {
    csv: 'text/csv;charset=utf-8',
    json: 'application/json;charset=utf-8',
    tsv: 'text/tab-separated-values;charset=utf-8',
    sql: 'text/plain;charset=utf-8',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export function buildExportFileName(baseName: string, format: GridExportFormat): string {
    const stem = baseName.replace(/\.[^.]+$/, '').trim() || 'export'
    return `${stem}.${FORMAT_EXT[format]}`
}

function resolveXlsxSheetName(fileName: string): string {
    return fileName.replace(/\.[^.]+$/, '').trim() || 'Report'
}

function cellToString(value: unknown): string {
    return formatCellFullValue(value)
}

function escapeCsvCell(value: string): string {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
    return value
}

function escapeTsvCell(value: string): string {
    return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
}

function escapeSqlString(value: string): string {
    return `'${value.replace(/'/g, "''")}'`
}

function sqlLiteral(value: string | number | boolean | null): string {
    if (value == null) return 'NULL'
    if (typeof value === 'number') return String(value)
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    return escapeSqlString(String(value))
}

export function serializeGridToCsv(columns: TableColumn[], rows: TableRow[]): string {
    const header = columns.map((col) => escapeCsvCell(col.name)).join(',')
    const lines = rows.map((row) =>
        columns.map((col) => escapeCsvCell(cellToString(readRowCell(row, col)))).join(','),
    )
    return [header, ...lines].join('\n')
}

export function serializeGridToTsv(columns: TableColumn[], rows: TableRow[]): string {
    const header = columns.map((col) => escapeTsvCell(col.name)).join('\t')
    const lines = rows.map((row) =>
        columns.map((col) => escapeTsvCell(cellToString(readRowCell(row, col)))).join('\t'),
    )
    return [header, ...lines].join('\n')
}

export function serializeGridToJson(columns: TableColumn[], rows: TableRow[]): string {
    const data = rows.map((row) => {
        const item: Record<string, TableCellValue> = {}
        for (const col of columns) {
            item[col.name] = readRowCell(row, col)
        }
        return item
    })
    return JSON.stringify(data, null, 2)
}

export function serializeGridToSql(
    columns: TableColumn[],
    rows: TableRow[],
    tableName = 'query_result',
): string {
    if (!columns.length) return '-- empty result\n'
    if (!rows.length) return `-- empty result\n`

    const safeTable = tableName.replace(/[^\w.]/g, '_') || 'query_result'
    const colNames = columns.map((col) => col.name).join(', ')
    const values = rows
        .map((row) => {
            const cells = columns.map((col) => sqlLiteral(readRowCellScalar(row, col))).join(', ')
            return `(${cells})`
        })
        .join(',\n')

    return `INSERT INTO ${safeTable} (${colNames}) VALUES\n${values};\n`
}

export function serializeGridData(
    columns: TableColumn[],
    rows: TableRow[],
    format: GridExportFormat,
    tableName?: string,
): string {
    switch (format) {
        case 'csv':
            return serializeGridToCsv(columns, rows)
        case 'tsv':
            return serializeGridToTsv(columns, rows)
        case 'json':
            return serializeGridToJson(columns, rows)
        case 'sql':
            return serializeGridToSql(columns, rows, tableName)
        default:
            return serializeGridToCsv(columns, rows)
    }
}

export async function createGridExportBlob(
    columns: TableColumn[],
    rows: TableRow[],
    format: GridExportFormat,
    tableName?: string,
    fileName?: string,
    options?: GridExportOptions,
): Promise<Blob> {
    const exportRows = options?.mask ? applyExportMasking(columns, rows, options.mask) : rows
    if (format === 'xlsx') {
        const buffer = await serializeGridToXlsxBuffer(columns, exportRows, {
            sheetName: resolveXlsxSheetName(fileName ?? tableName ?? 'Report'),
        })
        return new Blob([buffer], {type: FORMAT_MIME.xlsx})
    }
    const content = serializeGridData(columns, exportRows, format, tableName)
    const body = format === 'csv' ? `\uFEFF${content}` : content
    return new Blob([body], {type: FORMAT_MIME[format]})
}

export async function downloadGridExport(
    columns: TableColumn[],
    rows: TableRow[],
    format: GridExportFormat,
    fileName: string,
    tableName?: string,
    options?: GridExportOptions,
): Promise<string> {
    const resolvedName = buildExportFileName(fileName, format)
    const blob = await createGridExportBlob(columns, rows, format, tableName, resolvedName, options)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = resolvedName
    anchor.click()
    URL.revokeObjectURL(url)
    return resolvedName
}

/** 供测试校验列 key 映射 */
export function rowKeysForColumns(columns: TableColumn[]): string[] {
    return columns.map((col) => columnRowKey(col))
}
