import type {DbType} from '@/core/types'
import {
    buildQualifiedTableName,
    quoteSqlIdentifier,
} from '@/features/connection/services/sql-dialect.service'

export type AlterColumnOperation = 'add' | 'modify' | 'drop'

export interface AlterColumnSpec {
    name: string
    dataType: string
    nullable: boolean
    autoIncrement?: boolean
    defaultValue?: string | null
}

const PG_FAMILY = new Set<DbType>([
    'postgresql',
    'kingbase',
    'greenplum',
    'opengauss',
    'highgo',
])

const ALTER_WIZARD_DB_TYPES = new Set<DbType>([
    'mysql',
    'mariadb',
    'postgresql',
    'kingbase',
    'greenplum',
    'opengauss',
    'highgo',
    'sqlserver',
    'oracle',
    'dm',
])

export function supportsAlterColumnWizard(dbType: DbType | undefined): boolean {
    return !!dbType && ALTER_WIZARD_DB_TYPES.has(dbType)
}

function isPgFamily(dbType: DbType | undefined): boolean {
    return !!dbType && PG_FAMILY.has(dbType)
}

function quoteTable(dbType: DbType | undefined, tableName: string, database?: string): string {
    const table = tableName.trim()
    if (!table) return ''
    const db = database?.trim()
    if (!db) return quoteSqlIdentifier(dbType, table)
    return buildQualifiedTableName(dbType, db, table)
}

function formatDefaultClause(defaultValue?: string | null): string | null {
    if (defaultValue == null) return null
    const trimmed = String(defaultValue).trim()
    return trimmed ? `DEFAULT ${trimmed}` : null
}

function formatMysqlColumnDefinition(dbType: DbType | undefined, column: AlterColumnSpec): string {
    const name = quoteSqlIdentifier(dbType, column.name.trim())
    const parts = [name, column.dataType.trim()]
    if (!column.nullable) parts.push('NOT NULL')
    if (column.autoIncrement && (dbType === 'mysql' || dbType === 'mariadb')) {
        parts.push('AUTO_INCREMENT')
    }
    const defaultClause = formatDefaultClause(column.defaultValue)
    if (defaultClause) parts.push(defaultClause)
    return parts.join(' ')
}

function formatPgTypeClause(column: AlterColumnSpec): string {
    return column.dataType.trim()
}

/** 生成单列 ADD / MODIFY / DROP 的 ALTER TABLE SQL；校验失败返回 null */
export function buildAlterColumnSql(
    operation: AlterColumnOperation,
    options: {
        dbType?: DbType
        tableName: string
        database?: string
        column: AlterColumnSpec
    },
): string | null {
    const tableName = options.tableName.trim()
    const columnName = options.column.name.trim()
    if (!tableName || !columnName) return null

    const qualified = quoteTable(options.dbType, tableName, options.database)
    if (!qualified) return null

    const quotedColumn = quoteSqlIdentifier(options.dbType, columnName)

    if (operation === 'drop') {
        return `ALTER TABLE ${qualified} DROP COLUMN ${quotedColumn};`
    }

    const dataType = options.column.dataType.trim()
    if (!dataType) return null

    if (operation === 'add') {
        if (isPgFamily(options.dbType)) {
            const parts = [`ALTER TABLE ${qualified} ADD COLUMN ${quotedColumn} ${dataType}`]
            if (!options.column.nullable) parts[0] += ' NOT NULL'
            const defaultClause = formatDefaultClause(options.column.defaultValue)
            if (defaultClause) parts[0] += ` ${defaultClause}`
            return `${parts[0]};`
        }
        if (options.dbType === 'sqlserver') {
            const parts = [`ALTER TABLE ${qualified} ADD ${quotedColumn} ${dataType}`]
            if (!options.column.nullable) parts[0] += ' NOT NULL'
            const defaultClause = formatDefaultClause(options.column.defaultValue)
            if (defaultClause) parts[0] += ` ${defaultClause}`
            return `${parts[0]};`
        }
        if (options.dbType === 'oracle' || options.dbType === 'dm') {
            return `ALTER TABLE ${qualified} ADD (${formatMysqlColumnDefinition(options.dbType, options.column)});`
        }
        return `ALTER TABLE ${qualified} ADD COLUMN ${formatMysqlColumnDefinition(options.dbType, options.column)};`
    }

    // modify
    if (isPgFamily(options.dbType)) {
        const lines = [
            `ALTER TABLE ${qualified} ALTER COLUMN ${quotedColumn} TYPE ${formatPgTypeClause(options.column)};`,
            options.column.nullable
                ? `ALTER TABLE ${qualified} ALTER COLUMN ${quotedColumn} DROP NOT NULL;`
                : `ALTER TABLE ${qualified} ALTER COLUMN ${quotedColumn} SET NOT NULL;`,
        ]
        const defaultValue = options.column.defaultValue
        if (defaultValue != null && String(defaultValue).trim()) {
            lines.push(
                `ALTER TABLE ${qualified} ALTER COLUMN ${quotedColumn} SET DEFAULT ${String(defaultValue).trim()};`,
            )
        } else {
            lines.push(`ALTER TABLE ${qualified} ALTER COLUMN ${quotedColumn} DROP DEFAULT;`)
        }
        return lines.join('\n')
    }

    if (options.dbType === 'sqlserver') {
        const parts = [quotedColumn, dataType]
        if (!options.column.nullable) parts.push('NOT NULL')
        const defaultClause = formatDefaultClause(options.column.defaultValue)
        if (defaultClause) parts.push(defaultClause)
        return `ALTER TABLE ${qualified} ALTER COLUMN ${parts.join(' ')};`
    }

    if (options.dbType === 'oracle' || options.dbType === 'dm') {
        return `ALTER TABLE ${qualified} MODIFY (${formatMysqlColumnDefinition(options.dbType, options.column)});`
    }

    return `ALTER TABLE ${qualified} MODIFY COLUMN ${formatMysqlColumnDefinition(options.dbType, options.column)};`
}

export type BatchAlterColumnOperation = 'drop'

/** Concatenate per-column ALTER statements for a batch preview (no execution). */
export function buildBatchAlterColumnDdl(
    operation: BatchAlterColumnOperation,
    options: {
        dbType?: DbType
        tableName: string
        database?: string
        columnNames: string[]
    },
): string | null {
    const tableName = options.tableName.trim()
    if (!tableName) return null

    const names = options.columnNames.map((name) => name.trim()).filter(Boolean)
    if (names.length === 0) return null

    const statements: string[] = []
    for (const name of names) {
        const sql = buildAlterColumnSql(operation, {
            dbType: options.dbType,
            tableName,
            database: options.database,
            column: {name, dataType: '', nullable: true},
        })
        if (sql) statements.push(sql)
    }
    return statements.length > 0 ? statements.join('\n') : null
}
