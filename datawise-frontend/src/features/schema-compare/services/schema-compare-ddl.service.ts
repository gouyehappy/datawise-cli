import type {DbType} from '@/core/types'
import {quoteSqlIdentifier} from '@/features/connection/services/sql-dialect.service'
import type {TableSchemaDiff} from '@/features/schema-compare/types/schema-compare.types'

function quoteTable(dbType: DbType | undefined, tableName: string, database?: string): string {
    const table = quoteSqlIdentifier(dbType, tableName)
    if (!database?.trim()) return table
    const db = quoteSqlIdentifier(dbType, database)
    if (dbType === 'sqlserver') return `${db}..${table}`
    return `${db}.${table}`
}

function formatColumnTypeClause(
    dbType: DbType | undefined,
    column: NonNullable<TableSchemaDiff['columnDiffs'][number]['left']>,
): string {
    const parts = [column.dataType]
    if (!column.nullable) parts.push('NOT NULL')
    if (column.autoIncrement && (dbType === 'mysql' || dbType === 'mariadb')) {
        parts.push('AUTO_INCREMENT')
    }
    if (column.defaultValue != null && String(column.defaultValue).trim()) {
        parts.push(`DEFAULT ${column.defaultValue}`)
    }
    return parts.join(' ')
}

function formatColumnDefinition(
    dbType: DbType | undefined,
    column: NonNullable<TableSchemaDiff['columnDiffs'][number]['left']>,
): string {
    const name = quoteSqlIdentifier(dbType, column.name)
    return `${name} ${formatColumnTypeClause(dbType, column)}`
}

export function buildSchemaMigrateDdl(
    tableDiffs: TableSchemaDiff[],
    targetDbType: DbType | undefined,
    createDdls: Map<string, string>,
    targetDatabase?: string,
): string {
    const lines: string[] = [
        '-- Schema migration DDL (apply on RIGHT/target connection to match LEFT/reference)',
        '',
    ]

    for (const table of tableDiffs) {
        const qualified = quoteTable(targetDbType, table.tableName, targetDatabase)

        if (table.status === 'added') {
            const ddl = createDdls.get(table.tableName)
            lines.push(`-- Create missing table: ${table.tableName}`)
            lines.push(ddl ?? `-- TODO: CREATE TABLE ${qualified};`)
            lines.push('')
            continue
        }

        if (table.status === 'removed') {
            lines.push(`-- Drop extra table: ${table.tableName}`)
            lines.push(`DROP TABLE ${qualified};`)
            lines.push('')
            continue
        }

        if (table.status !== 'changed' || !table.columnDiffs.length) continue

        lines.push(`-- Alter table: ${table.tableName}`)
        for (const column of table.columnDiffs) {
            if (column.status === 'added' && column.left) {
                if (targetDbType === 'postgresql' || targetDbType === 'kingbase' || targetDbType === 'greenplum' || targetDbType === 'opengauss' || targetDbType === 'highgo') {
                    lines.push(
                        `ALTER TABLE ${qualified} ADD COLUMN ${formatColumnDefinition(targetDbType, column.left)};`,
                    )
                } else {
                    lines.push(
                        `ALTER TABLE ${qualified} ADD COLUMN ${formatColumnDefinition(targetDbType, column.left)};`,
                    )
                }
                continue
            }
            if (column.status === 'removed' && column.right) {
                lines.push(
                    `ALTER TABLE ${qualified} DROP COLUMN ${quoteSqlIdentifier(targetDbType, column.right.name)};`,
                )
                continue
            }
            if (column.status === 'modified' && column.left) {
                if (targetDbType === 'postgresql' || targetDbType === 'kingbase' || targetDbType === 'greenplum' || targetDbType === 'opengauss' || targetDbType === 'highgo') {
                    lines.push(
                        `ALTER TABLE ${qualified} ALTER COLUMN ${formatColumnDefinition(targetDbType, column.left)};`,
                    )
                } else if (targetDbType === 'sqlserver') {
                    lines.push(
                        `ALTER TABLE ${qualified} ALTER COLUMN ${quoteSqlIdentifier(targetDbType, column.left.name)} ${formatColumnTypeClause(targetDbType, column.left)};`,
                    )
                } else if (targetDbType === 'oracle' || targetDbType === 'dm') {
                    lines.push(
                        `ALTER TABLE ${qualified} MODIFY (${formatColumnDefinition(targetDbType, column.left)});`,
                    )
                } else {
                    lines.push(
                        `ALTER TABLE ${qualified} MODIFY COLUMN ${formatColumnDefinition(targetDbType, column.left)};`,
                    )
                }
            }
        }
        lines.push('')
    }

    if (lines.length <= 2) {
        lines.push('-- No DDL changes required')
    }

    return lines.join('\n').trimEnd()
}
