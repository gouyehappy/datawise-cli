import type {PlatformApi} from '@/shared/api/types'
import type {
    AnalysisCanvasDetail,
    AnalysisCanvasSummary,
    AutoGenerateSemanticMetricsRequest,
    ExecuteFederatedViewRequest,
    FederatedViewDetail,
    FederatedViewExecuteResult,
    GenerateFederatedSqlRequest,
    GenerateFederatedSqlResult,
    FederatedViewSummary,
    QueryLibraryVersion,
    RerunAnalysisCanvasRequest,
    RerunAnalysisCanvasResult,
    SaveAnalysisCanvasRequest,
    SaveFederatedViewRequest,
    SaveQueryLibraryVersionRequest,
    SaveScheduledTaskRequest,
    SaveSchemaDriftMonitorRequest,
    SaveSemanticMetricRequest,
    ScheduledTask,
    SchemaDriftCompareRequest,
    SchemaDriftMonitor,
    SchemaDriftReport,
    SemanticMetric,
    SqlReviewRequest,
    SqlReviewResult,
} from '@/features/platform/types/platform.types'
import {deleteJson, getJson, postJson, putJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

function encodeId(id: string): string {
    return encodeURIComponent(id)
}

export function createHttpPlatformApi(): PlatformApi {
    const paths = API_PATHS.platform

    return {
        listAnalysisCanvas: () =>
            getJson<AnalysisCanvasSummary[]>(paths.analysisCanvas),

        getAnalysisCanvas: (id) =>
            getJson<AnalysisCanvasDetail>(`${paths.analysisCanvas}/${encodeId(id)}`),

        saveAnalysisCanvas: (request) =>
            putJson<AnalysisCanvasDetail>(paths.analysisCanvas, request),

        deleteAnalysisCanvas: (id) =>
            deleteJson<void>(`${paths.analysisCanvas}/${encodeId(id)}`),

        rerunAnalysisCanvas: (request) =>
            postJson<RerunAnalysisCanvasResult>(paths.analysisCanvasRerun, request),

        listSemanticMetrics: (connectionId, database) =>
            getJson<SemanticMetric[]>(paths.semanticMetrics, {connectionId, database}),

        saveSemanticMetric: (request) =>
            putJson<SemanticMetric>(paths.semanticMetrics, request),

        deleteSemanticMetric: (id) =>
            deleteJson<void>(`${paths.semanticMetrics}/${encodeId(id)}`),

        autoGenerateSemanticMetrics: (request) =>
            postJson<SemanticMetric[]>(paths.semanticMetricsAutoGenerate, request),

        reviewSql: (request) =>
            postJson<SqlReviewResult>(paths.sqlReview, request),

        listFederatedViews: () =>
            getJson<FederatedViewSummary[]>(paths.federatedViews),

        getFederatedView: (id) =>
            getJson<FederatedViewDetail>(`${paths.federatedViews}/${encodeId(id)}`),

        saveFederatedView: (request) =>
            putJson<FederatedViewDetail>(paths.federatedViews, request),

        deleteFederatedView: (id) =>
            deleteJson<void>(`${paths.federatedViews}/${encodeId(id)}`),

        executeFederatedView: (request) =>
            postJson<FederatedViewExecuteResult>(paths.federatedViewsExecute, request),

        generateFederatedSql: (request) =>
            postJson<GenerateFederatedSqlResult>(paths.federatedViewsGenerateSql, request),

        listSchemaDriftMonitors: () =>
            getJson<SchemaDriftMonitor[]>(paths.schemaDriftMonitors),

        saveSchemaDriftMonitor: (request) =>
            putJson<SchemaDriftMonitor>(paths.schemaDriftMonitors, request),

        deleteSchemaDriftMonitor: (id) =>
            deleteJson<void>(`${paths.schemaDriftMonitors}/${encodeId(id)}`),

        compareSchemaDrift: (request) =>
            postJson<SchemaDriftReport>(paths.schemaDriftCompare, request),

        runSchemaDriftMonitor: (id) =>
            postJson<SchemaDriftReport>(paths.schemaDriftMonitorRun(id), {}),

        listScheduledTasks: () =>
            getJson<ScheduledTask[]>(paths.scheduledTasks),

        saveScheduledTask: (request) =>
            putJson<ScheduledTask>(paths.scheduledTasks, request),

        deleteScheduledTask: (id) =>
            deleteJson<void>(`${paths.scheduledTasks}/${encodeId(id)}`),

        runScheduledTask: (id) =>
            postJson<ScheduledTask>(paths.scheduledTaskRun(id), {}),

        listQueryLibraryVersions: (teamId, queryId) =>
            getJson<QueryLibraryVersion[]>(paths.queryLibraryVersions(teamId, queryId)),

        saveQueryLibraryVersion: (request) =>
            postJson<QueryLibraryVersion>(paths.queryLibrarySaveVersion, request),
    }
}
