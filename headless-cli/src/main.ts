#!/usr/bin/env node
import {Command} from 'commander'
import {registerConfigMigrateCommand} from './commands/config-migrate.js'
import {registerMigrateRunCommand} from './commands/migrate-run.js'
import {registerQueryLibraryCommand} from './commands/query-library.js'
import {registerSqlExecCommand} from './commands/sql-exec.js'

const program = new Command('datawise')
    .description('DataWise headless CLI for CI and automation')
    .version('4.0.1')
    .option('--server <url>', 'Backend base URL', process.env.DATAWISE_SERVER ?? 'http://localhost:18421')
    .option('--token <token>', 'API token (or DATAWISE_API_TOKEN env)')

const migrate = program.command('migrate').description('Table migration commands')
registerMigrateRunCommand(migrate)

const sql = program.command('sql').description('SQL execution commands')
registerSqlExecCommand(sql)

registerQueryLibraryCommand(program)
registerConfigMigrateCommand(program)

program.parseAsync(process.argv).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Error: ${message}`)
    process.exit(1)
})
