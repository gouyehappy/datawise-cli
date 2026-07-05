import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dir = path.join(root, 'datawise-frontend', 'src', 'features', 'explorer', 'services')
const srcPath = path.join(dir, 'table-migration.service.ts')
const src = fs.readFileSync(srcPath, 'utf8')

const serviceOnly = new Set([
    'fetchTablesForScope',
    'runTableMigrationPreflight',
    'runTableMigration',
    'restartTableMigrationFresh',
    'pauseMigrationJob',
    'watchExistingMigrationJob',
    'resumeTableMigrationRun',
    'saveMigrationRunToHistory',
    'loadMigrationRunHistory',
    'saveActiveMigrationRunSnapshot',
    'loadActiveMigrationRunSnapshot',
    'clearActiveMigrationRunSnapshot',
    'saveActiveMigrationProgressSnapshot',
    'loadActiveMigrationProgressSnapshot',
    'clearActiveMigrationProgressSnapshot',
    'downloadMigrationRunReport',
    'runBatchJobMigration',
    'watchMigrationJobUntilDone',
    'pollMigrationJobUntilDone',
    'createMigrationJobStreamCoordinator',
    'appendTableStartLog',
    'appendTableResultLog',
    'appendTableMigrationLog',
    'buildMigrationBatchRequest',
    'resolveMigrationJobFailureMessage',
])

function extractTopLevelBlocks(text) {
    const blocks = []
    const headerEnd = text.search(/^export /m)
    if (headerEnd < 0) throw new Error('header not found')
    blocks.push({name: '__header__', text: text.slice(0, headerEnd), kind: 'header'})

    const body = text.slice(headerEnd)
    const declRe =
        /^(export (?:async )?function \w+|export const \w+|export type \w+|export interface \w+|async function \w+|const \w+|function \w+)/gm
    const starts = []
    let m
    while ((m = declRe.exec(body)) !== null) {
        starts.push(m.index)
    }

    for (let i = 0; i < starts.length; i++) {
        const start = starts[i]
        const end = i + 1 < starts.length ? starts[i + 1] : body.length
        const chunk = body.slice(start, end)
        const nameMatch = chunk.match(
            /^export (?:async )?function (\w+)|^export const (\w+)|^export type (\w+)|^export interface (\w+)|^async function (\w+)|^(?:const|function) (\w+)/,
        )
        const name =
            nameMatch?.[1] ??
            nameMatch?.[2] ??
            nameMatch?.[3] ??
            nameMatch?.[4] ??
            nameMatch?.[5] ??
            nameMatch?.[6] ??
            `anon_${i}`
        blocks.push({name, text: chunk, kind: 'body'})
    }
    return blocks
}

function exportify(name, text) {
    if (name.startsWith('__')) return text
    if (text.startsWith('export ')) return text
    if (text.startsWith('const ') || text.startsWith('function ')) {
        return text.replace(/^(const|function) /, 'export $1 ')
    }
    return text
}

const blocks = extractTopLevelBlocks(src)
const pureParts = []
const serviceParts = []

for (const block of blocks) {
    if (block.kind === 'header') {
        pureParts.push(block.text)
        continue
    }
    const exported = exportify(block.name, block.text)
    if (serviceOnly.has(block.name)) {
        serviceParts.push(block.text.startsWith('export') ? block.text : exported.replace(/^export /, ''))
    } else {
        pureParts.push(exported)
    }
}

const purePath = path.join(dir, 'table-migration.pure.ts')
fs.writeFileSync(purePath, pureParts[0] + pureParts.slice(1).join(''))

const serviceImports = `export * from './table-migration.pure'

import type {TreeNode} from '@/core/types'
import type {SchemaScope} from '@/features/schema-compare/types/schema-compare.types'
import type {
    MigrationJobView,
    TableMigrationBatchRequest,
    TableMigrationBatchTableRequest,
    TableMigrationPreflightResult,
    TableMigrationResult,
} from '@/shared/api/types'
import type {
    TableMigrationTableBatchProgressEvent,
    TableMigrationTableResultEvent,
    TableMigrationTableStartEvent,
} from '@/shared/api/http/migration-stream'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {
    canPersistLocalResource,
    canReadResource,
    resolveResourceStorageKey,
} from '@/features/auth/services/user-resource-policy'
import {
    ensureMigrationSourceSchemaLoaded,
    listTablesForScope,
    resolveRunningTableFromJob,
    appendMigrationLog,
    buildMigrationRunRecord,
    buildPreflightRequest,
    buildTableRowTotalsFromPreflight,
    createMigrationRunId,
    progressFromMigrationJobView,
    recordToMigrationForm,
    recordToSourceScope,
    resolveMigrationTables,
    shouldCreateTargetTable,
    validateTableMigrationForPreflight,
    validateTableMigrationForm,
    shouldAppendBatchProgressLog,
    summarizeMigrationResults,
    canResumeMigrationRun,
    MIGRATION_JOB_TERMINAL_STATUSES,
    MIGRATION_JOB_POLL_MS,
    MIGRATION_HISTORY_MAX,
    MIGRATION_ACTIVE_RUN_STORAGE_KEY,
    MIGRATION_ACTIVE_PROGRESS_STORAGE_KEY,
    resolveMigrationHistoryStorageKey,
    sleep,
    type EnsureChildrenLoaded,
    type FetchTablesForScopeOptions,
    type MigrationJobWatchCallbacks,
    type MigrationLogLine,
    type MigrationRunOptions,
    type TableMigrationRunOutcome,
    type TableMigrationRunProgress,
    type TableMigrationRunRecord,
    type TableMigrationWizardForm,
} from './table-migration.pure'

`

const servicePath = path.join(dir, 'table-migration.service.ts')
fs.writeFileSync(servicePath, serviceImports + serviceParts.join(''))

console.log('blocks', blocks.length, 'pure', pureParts.length - 1, 'service', serviceParts.length)
