import {getJson, postJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'
import type {
    MigrationJobView,
    TableMigrationBatchRequest,
    TableMigrationBatchResult,
    TableMigrationPreflightRequest,
    TableMigrationPreflightResult,
    TableMigrationRequest,
    TableMigrationResult,
    MigrationApi,
} from '@/shared/api/types'

export function createHttpMigrationApi(): MigrationApi {
    return {
        migrateTable: (request: TableMigrationRequest) =>
            postJson<TableMigrationResult>(API_PATHS.migration.table, request),
        migrateTablesBatch: (request: TableMigrationBatchRequest) =>
            postJson<TableMigrationBatchResult>(API_PATHS.migration.tablesBatch, request),
        preflight: (request: TableMigrationPreflightRequest) =>
            postJson<TableMigrationPreflightResult>(API_PATHS.migration.preflight, request),
        getJob: (jobId: string) =>
            getJson<MigrationJobView>(API_PATHS.migration.job(jobId)),
        startJob: (request: TableMigrationBatchRequest) =>
            postJson<MigrationJobView>(API_PATHS.migration.jobs, request),
        pauseJob: (jobId: string) =>
            postJson<MigrationJobView>(API_PATHS.migration.jobPause(jobId), {}),
        resumeJob: (jobId: string) =>
            postJson<MigrationJobView>(API_PATHS.migration.jobResume(jobId), {}),
    }
}
