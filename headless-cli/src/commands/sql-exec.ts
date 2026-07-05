import {readFileSync} from 'node:fs'
import type {Command} from 'commander'
import {DatawiseClient} from '../client.js'
import {resolveConfig} from '../config.js'
import {formatSqlResult} from '../format.js'

export interface SqlExecOptions {
    connection: string
    database?: string
    file?: string
    maxRows?: string
    json?: boolean
}

export function readSqlFromFile(path: string): string {
    const sql = readFileSync(path, 'utf8').trim()
    if (!sql) {
        throw new Error(`SQL file is empty: ${path}`)
    }
    return sql
}

export function registerSqlExecCommand(sql: Command): void {
    sql
        .command('exec')
        .description('Execute SQL from a file via headless API')
        .requiredOption('--connection <id>', 'Connection id')
        .option('--database <name>', 'Database / schema name')
        .requiredOption('-f, --file <path>', 'SQL file path')
        .option('--max-rows <n>', 'Maximum rows to return for SELECT')
        .option('--json', 'Print raw JSON result')
        .action(async (options: SqlExecOptions, command: Command) => {
            const config = resolveConfig(command)
            const sqlText = readSqlFromFile(options.file!)
            const client = new DatawiseClient(config)
            const result = await client.executeSql({
                sql: sqlText,
                connectionId: options.connection,
                database: options.database,
                maxRows: options.maxRows ? Number.parseInt(options.maxRows, 10) : undefined,
            })
            process.stdout.write(formatSqlResult(result, !!options.json))
        })
}
