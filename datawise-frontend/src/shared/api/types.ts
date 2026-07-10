import type {
    AppNotification,
    ConnectionConfig,
    ExportTask,
    NotificationCategory,
    PluginItem,
    SavedConsole,
    SqlLogEntry,
    TableColumn,
    TableRow,
    TeamAuditLog,
    TeamAuditLogQuery,
    TeamInvite,
    TeamJoinRequest,
    TeamMember,
    JoinTeamResult,
    TeamSharedAiSessionDetail,
    TeamSharedAiSessionSummary,
    TeamSharedQueryComment,
    TeamSharedQueryDetail,
    TeamSharedQuerySummary,
    ShareTeamSharedQueryPayload,
    TeamProductionApprovalDetail,
    TeamProductionApprovalSummary,
    SubmitTeamProductionApprovalPayload,
    TeamSummary,
    TreeNode,
} from '@/core/types'
import type {HttpRequestOptions} from '@/shared/api/http/request'
import type {AiDatabaseTarget} from '@/features/ai/shared/utils/database-targets'
import type {AiChatReplyPayload, AiAnalysisContextPayload} from '@/features/ai/types/analysis'
import type {AiEmbeddingProfile, AiLlmSettings, AiPreferences} from '@/shared/config/app-config.types'
import type {HealthSnapshot} from '@/shared/api/http/system'
import type {AppConfigFile} from '@/shared/config/app-config.types'
import type {SqlEditorShortcutsLayer} from '@datawise/sql-editor/types'
import type {UpdatePreferences} from '@/features/settings/services/about-settings.service'
import type {ConnectionsCatalog} from '@/shared/config/connections-catalog.types'
import type {DatasourceDefinition, JdbcDriverResolveResult} from '@/features/datasource/types/datasource.types'
import type {
    AnalysisCanvasDetail,
    AnalysisCanvasSummary,
    AutoGenerateSemanticMetricsRequest,
    ExecuteFederatedViewRequest,
    FederatedViewDetail,
    FederatedViewSummary,
    GenerateFederatedSqlRequest,
    GenerateFederatedSqlResult,
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

// ── Auth ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
    code: number
    msg: string
    data: T
}

export interface LoginResult {
    sessionId: string
    userName?: string
    securityConfigType?: string
    expiresAtEpochMs?: number | null
    userId?: number | null
}

export interface SessionInfo {
    sessionId: string
    userName: string
    guest: boolean
    expiresAtEpochMs?: number | null
    userId?: number | null
}

export interface AuthSessionPolicy {
    ttlMinutes: number
    slidingRenewal: boolean
}

export interface AuthUser {
    userName: string
    userId?: number | null
    displayName: string
    email: string
    isGuest: boolean
}

export interface AuthUserProfile {
    displayName: string
    email: string
}

export interface AuthApi {
    login(userName: string, userPassword: string): Promise<LoginResult>

    loginAsGuest(): Promise<LoginResult>

    signOut(): Promise<void>

    getCurrentSession(options?: HttpRequestOptions): Promise<SessionInfo>

    getSessionPolicy(): Promise<AuthSessionPolicy>

    updateSessionPolicy(policy: AuthSessionPolicy): Promise<AuthSessionPolicy>

    changePassword(currentPassword: string, newPassword: string): Promise<void>

    resolveUserProfile(userName: string, isGuest: boolean): AuthUserProfile
}

// ── SQL ─────────────────────────────────────────────────────────────────────

export interface ExecuteSqlResult {
    sql: string
    rowCount: number
    durationMs: number
    columns: TableColumn[]
    rows: TableRow[]
    where?: string
    orderBy?: string
    cursorId?: string
    hasMore?: boolean
    pageOffset?: number
    pageSize?: number
}

export interface SqlExecuteOptions {
    connectionId?: string
    database?: string
    maxRows?: number
    pageSize?: number
    cursorId?: string
    /** 控制台 Tab ID，用于手动事务模式复用 JDBC 会话 */
    sessionKey?: string
    /** 编辑器执行来源，供后端 PERF 日志区分 toolbar / gutter / shortcut 等 */
    perfSource?: string
}

export interface SqlSessionStatus {
    autocommit: boolean
    pending: boolean
    connectionId?: string | null
    database?: string | null
}

export interface SqlSessionOptions {
    sessionKey: string
    connectionId: string
    database?: string
}

export interface SqlGenerateFromPromptOptions {
    connectionId?: string
    database?: string
    prefs?: AiPreferences
}

export interface ActiveSession {
    sessionId: string
    user: string
    host: string
    database: string
    state: string
    command: string
    durationSeconds: number
    sql: string
}

export interface ActiveSessionList {
    sessions: ActiveSession[]
    supported: boolean
    message?: string | null
}

export interface ActiveSessionQuery {
    connectionId: string
    database?: string
}

export interface LockWaitEdge {
    waitingSessionId: string
    blockingSessionId: string
    waitSeconds: number
    waitingSql: string
    blockingSql: string
    waitingUser?: string
    blockingUser?: string
}

export interface LockWaitList {
    edges: LockWaitEdge[]
    supported: boolean
    message?: string | null
}

export interface LockWaitQuery {
    connectionId: string
    database?: string
}

export type SessionKillMode = 'query' | 'connection'

export interface KillSessionRequest {
    connectionId: string
    database?: string
    sessionId: string
    mode?: SessionKillMode
}

export interface KillSessionResult {
    sessionId: string
    mode: SessionKillMode
    sql: string
    killed: boolean
    message: string
}

export interface CancelConsoleSqlRequest {
    sessionKey: string
    mode?: SessionKillMode
}

export interface CancelConsoleSqlResult {
    cancelled: boolean
    mode: SessionKillMode
    message: string
}

export interface SqlApi {
    execute(sql: string, options?: SqlExecuteOptions): Promise<ExecuteSqlResult>

    fetchCursorPage(cursorId: string, pageSize?: number): Promise<ExecuteSqlResult>

    generateFromPrompt(prompt: string, options?: SqlGenerateFromPromptOptions): Promise<string>

    fetchSessionStatus(sessionKey: string): Promise<SqlSessionStatus>

    beginSession(options: SqlSessionOptions): Promise<SqlSessionStatus>

    setSessionAutocommit(options: SqlSessionOptions & { autocommit: boolean }): Promise<SqlSessionStatus>

    commitSession(options: SqlSessionOptions): Promise<SqlSessionStatus>

    rollbackSession(options: SqlSessionOptions): Promise<SqlSessionStatus>

    closeSession(sessionKey: string): Promise<void>

    fetchActiveSessions(query: ActiveSessionQuery): Promise<ActiveSessionList>

    fetchLockWaits(query: LockWaitQuery): Promise<LockWaitList>

    killSession(request: KillSessionRequest): Promise<KillSessionResult>

    cancelExecution(request: CancelConsoleSqlRequest): Promise<CancelConsoleSqlResult>
}

// ── AI ──────────────────────────────────────────────────────────────────────

export interface AiReplyContext {
    targets?: AiDatabaseTarget[]
    aiPreferences?: AiPreferences
    analysisContext?: AiAnalysisContextPayload
}

export interface LlmTestResult {
    ok: boolean
    message: string
}

export interface AiRagStatus {
    vectorStore: string
    vectorStoreEnabled: boolean
    retrieverAvailable: boolean
    pgvectorConfigured: boolean
    knowledgeEntryCount: number
    message: string
    embeddingProvider?: string
    embeddingConfigured?: boolean
    embeddingDimensions?: number
    serverVectorStore?: string
    userConfigured?: boolean
}

export interface AiRagRebuildResult {
    syncedEntries: number
    message: string
}

export interface AiPythonRuntime {
    enabled: boolean
    executor: string
    sandboxEnabled: boolean
    dependencyInstallEnabled: boolean
    dockerImage: string
    k8sNamespace: string
    timeoutSeconds: number
    dependencyInstallTimeoutSeconds: number
    maxRetries: number
}

export interface AiApi {
    generateReply(prompt: string, context?: AiReplyContext): Promise<AiChatReplyPayload>

    testConnection(settings: AiLlmSettings): Promise<LlmTestResult>
    testEmbedding(profile: AiEmbeddingProfile): Promise<LlmTestResult>

    syncPreferences(prefs: AiPreferences): void

    fetchKnowledgeEntries(): Promise<import('@/features/ai/knowledge/types/ai-knowledge.types').AiKnowledgeEntry[]>

    saveKnowledgeEntries(
        entries: import('@/features/ai/knowledge/types/ai-knowledge.types').AiKnowledgeEntry[],
    ): Promise<import('@/features/ai/knowledge/types/ai-knowledge.types').AiKnowledgeEntry[]>

    fetchRagStatus(connectionId?: string, database?: string): Promise<AiRagStatus>

    rebuildRagIndex(connectionId?: string, database?: string): Promise<AiRagRebuildResult>

    fetchSchemaTables(
        connectionId: string,
        database?: string,
        options?: HttpRequestOptions,
    ): Promise<string[]>

    fetchAiTableTags(connectionId: string, database?: string): Promise<string[]>

    fetchAiTableTagCatalog(): Promise<import('@/features/ai/tag/types/ai-table-tag.types').AiTableTagCatalogItem[]>

    updateAiTableTags(request: {
        connectionId: string
        database: string
        tableNames: string[]
        tagged: boolean
    }): Promise<string[]>

    fetchPythonRuntime(): Promise<AiPythonRuntime>
}

// ── Table data ──────────────────────────────────────────────────────────────

export interface TableDataResult {
    columns: TableColumn[]
    rows: TableRow[]
    cursorId?: string
    hasMore?: boolean
    pageOffset?: number
    pageSize?: number
}

export interface TableDataFetchOptions {
    connectionId?: string
    database?: string
    maxRows?: number
    cursorId?: string
}

export interface TableRowMutateRequest {
    connectionId: string
    database?: string
    values: Record<string, string | number | boolean | null>
}

export interface TableRowMutateResult {
    affectedRows: number
    sql: string
}

export interface TableRowUpdateRequest {
    connectionId: string
    database?: string
    keyValues: Record<string, string | number | boolean | null>
    values: Record<string, string | number | boolean | null>
}

export type TableDataChangeOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'RESTORE'

export interface TableDataChangeAuditEntry {
    id: string
    createdAtMs: number
    operation: TableDataChangeOperation
    beforeRow?: Record<string, string | number | boolean | null> | null
    afterRow?: Record<string, string | number | boolean | null> | null
    primaryKey?: Record<string, string | number | boolean | null> | null
    reverted: boolean
    restoredFromId?: string | null
}

export interface TableDataApi {
    fetch(tableName?: string, options?: TableDataFetchOptions): Promise<TableDataResult>

    insertRow(
        tableName: string,
        request: TableRowMutateRequest,
    ): Promise<TableRowMutateResult>

    updateRow(
        tableName: string,
        request: TableRowUpdateRequest,
    ): Promise<TableRowMutateResult>

    deleteRow(
        tableName: string,
        request: TableRowMutateRequest,
    ): Promise<TableRowMutateResult>

    listAudit(
        tableName: string,
        options: { connectionId: string; database?: string; limit?: number },
    ): Promise<TableDataChangeAuditEntry[]>

    restoreAudit(
        tableName: string,
        auditId: string,
        request: Pick<TableRowMutateRequest, 'connectionId' | 'database'>,
    ): Promise<TableRowMutateResult>
}

export interface TableColumnDetail {
    ordinal: number
    name: string
    dataType: string
    nullable: boolean
    autoIncrement: boolean
    keyType?: string | null
    defaultValue?: string | null
    extra?: string | null
    comment?: string | null
}

export interface TableForeignKeyDetail {
    name: string
    columns: string
    referenceTable: string
    referenceColumns: string
}

export interface TableRelationEdge {
    constraintName: string
    sourceTable: string
    sourceColumns: string
    targetTable: string
    targetColumns: string
}

export interface TableRelationsResult {
    tableName: string
    references: TableRelationEdge[]
    referencedBy: TableRelationEdge[]
}

export interface SchemaRelationsResult {
    database: string
    tables: string[]
    edges: TableRelationEdge[]
}

export interface SchemaTableSummary {
    tableName: string
    rowCount: number | null
    engine: string | null
    collation: string | null
    dataLength: number | null
    createTime: string | null
    comment: string | null
}

export interface SchemaTablesResult {
    database: string
    tables: SchemaTableSummary[]
}

export interface TableIndexDetail {
    name: string
    unique: boolean
    columns: string
}

export interface TablePropertiesResult {
    tableName: string
    comment?: string | null
    engine?: string | null
    charset?: string | null
    collation?: string | null
    autoIncrement?: string | null
    columns: TableColumnDetail[]
    foreignKeys: TableForeignKeyDetail[]
    indexes: TableIndexDetail[]
}

export interface TableDdlResult {
    ddl: string
}

export interface TableSqlExportResult {
    sql: string
    fileName: string
}

// ── Datagen ──────────────────────────────────────────────────────────────────

export interface DatagenPreviewRequest {
    connectionId: string
    database?: string | null
    tableName: string
    rowCount?: number | null
    seed?: number | null
}

export interface DatagenPreviewResult {
    connectionId: string
    database: string
    tableName: string
    rowCount: number
    seed: number
    previewRows: TableRow[]
    insertSql: string
}

export interface DatagenApi {
    previewTableDatagen(request: DatagenPreviewRequest): Promise<DatagenPreviewResult>
    executeTableDatagen(request: DatagenPreviewRequest): Promise<ExecuteSqlResult>
}

export interface MetadataDocPreviewOptions {
    connectionId?: string
    database?: string
    format?: 'md' | 'markdown' | 'html'
    includeDetails?: boolean
}

export interface MetadataDocPreviewResult {
    database: string
    connectionId?: string | null
    format: string
    fileName: string
    markdown: string
    html: string
}

export interface TableMigrationRequest {
    sourceConnectionId: string
    sourceDatabase: string
    targetConnectionId: string
    targetDatabase: string
    tableName: string
    mode?: string
    watermarkColumn?: string
    orderByColumns?: string[]
    whereClause?: string
    batchSize?: number
    throttleMs?: number
    truncateTarget?: boolean
    createTargetIfMissing?: boolean
    sourceSelectSql?: string
    targetTableName?: string
}

export interface TableMigrationBatchTableRequest {
    tableName: string
    createTargetIfMissing?: boolean
}

export interface TableMigrationBatchRequest {
    sourceConnectionId: string
    sourceDatabase: string
    targetConnectionId: string
    targetDatabase: string
    tables: TableMigrationBatchTableRequest[]
    mode?: string
    watermarkColumn?: string
    orderByColumns?: string[]
    whereClause?: string
    batchSize?: number
    throttleMs?: number
    truncateTarget?: boolean
    jobId?: string
    resumeJobId?: string
}

export interface TableMigrationBatchResult {
    jobId?: string | null
    results: TableMigrationResult[]
}

export interface TableMigrationResult {
    tableName: string
    rowsMigrated: number
    batches: number
    durationMs: number
    status: string
    message?: string | null
    sourceRowCount?: number | null
    targetRowCountBefore?: number | null
    targetRowCountAfter?: number | null
    rowCountValidation?: 'match' | 'mismatch' | 'skipped' | string | null
}

export interface TableMigrationPreflightRequest {
    sourceConnectionId: string
    sourceDatabase: string
    targetConnectionId: string
    targetDatabase: string
    tableNames: string[]
    whereClause?: string
}

export interface MigrationColumnTypeMapping {
    columnName: string
    sourceType: string
    targetType: string
    warning?: string | null
}

export interface TableMigrationPreflightTableResult {
    tableName: string
    sourceExists: boolean
    targetExists: boolean
    sourceRowCount: number | null
    targetRowCount: number | null
    sourceColumnCount: number
    targetColumnCount: number
    missingOnTarget: string[]
    extraOnTarget: string[]
    suggestedWatermarkColumns: string[]
    status: 'ready' | 'warn' | 'blocked' | string
    issues: string[]
    columnMappings: MigrationColumnTypeMapping[]
    suggestedCreateDdl?: string | null
    mappingWarnings: string[]
}

export interface TableMigrationPreflightResult {
    readyCount: number
    warnCount: number
    blockedCount: number
    canProceed: boolean
    tables: TableMigrationPreflightTableResult[]
}

export interface TableDetailFetchOptions {
    connectionId?: string
    database?: string
    kind?: 'table' | 'view'
}

export interface TableSqlExportOptions extends TableDetailFetchOptions {
    includeData?: boolean
    maxRows?: number
}

export interface TableDetailApi {
    fetchProperties(tableName: string, options?: TableDetailFetchOptions): Promise<TablePropertiesResult>

    fetchDdl(tableName: string, options?: TableDetailFetchOptions): Promise<TableDdlResult>

    fetchRelations(tableName: string, options?: TableDetailFetchOptions): Promise<TableRelationsResult>

    fetchSchemaRelations(options?: TableDetailFetchOptions): Promise<SchemaRelationsResult>

    fetchSchemaTables(options?: TableDetailFetchOptions): Promise<SchemaTablesResult>

    exportTableSql(tableName: string, options?: TableSqlExportOptions): Promise<TableSqlExportResult>

    exportDatabaseSql(options: TableSqlExportOptions): Promise<TableSqlExportResult>

    previewDatabaseMetadoc(options: MetadataDocPreviewOptions): Promise<MetadataDocPreviewResult>
}

// ── Connection ──────────────────────────────────────────────────────────────

export interface ConnectionTestResult {
    ok: boolean
    message: string
    latencyMs: number
}

export interface ConnectionApi {
    test(config: ConnectionConfig): Promise<ConnectionTestResult>
}

// ── Terminal ────────────────────────────────────────────────────────────────

export type TerminalOutputLineType = 'out' | 'err' | 'sys'

export interface TerminalOutputLine {
    type: TerminalOutputLineType
    text: string
}

export interface TerminalShellContext {
    cwd: string
    platform: string
}

export interface TerminalExecResult {
    lines: TerminalOutputLine[]
    cwd?: string
}

export interface TerminalStatus {
    websocketEnabled: boolean
    ptyAvailable: boolean
    websocketPath: string
}

export interface TerminalApi {
    execute(input: string, ctx: TerminalShellContext): Promise<TerminalExecResult>

    welcome(platform: string): Promise<string>

    status(): Promise<TerminalStatus>
}

// ── Explorer ────────────────────────────────────────────────────────────────

export interface ExplorerFetchOptions {
    refresh?: boolean
}

export interface ExplorerGroupResult {
    groupId: string
    tree: TreeNode[]
}

export interface ExplorerConnectionResult {
    connectionId: string
    tree: TreeNode[]
}

export interface ExplorerImportResult {
    count: number
    tree: TreeNode[]
}

export interface ExplorerLoadChildrenResult {
    tree: TreeNode[]
    hasMore?: boolean
    nextOffset?: number
    etag?: string | null
    unchanged?: boolean
}

export interface ExplorerApi {
    fetchTree(options?: ExplorerFetchOptions): Promise<TreeNode[]>

    loadChildren(
        connectionId: string,
        nodeId: string,
        options?: {
            silent?: boolean
            pattern?: string
            refresh?: boolean
            offset?: number
            limit?: number
            skeleton?: boolean
            ifNoneMatch?: string
        },
    ): Promise<ExplorerLoadChildrenResult>

    fetchRedisKey(
        connectionId: string,
        key: string,
        options?: { database?: number },
    ): Promise<import('@/features/explorer/services/redis-key.service').RedisKeyDetail>

    fetchRedisKeysScan(
        connectionId: string,
        options?: { pattern?: string; cursor?: string; count?: number; database?: number },
    ): Promise<import('@/features/explorer/services/redis-keys-scan.service').RedisKeysScanResult>

    executeRedisCommand(
        connectionId: string,
        command: string,
        options?: { database?: number },
    ): Promise<import('@/features/explorer/services/redis-console.service').RedisCommandResult>

    fetchKafkaTopics(
        connectionId: string,
        options?: { pattern?: string; limit?: number },
    ): Promise<import('@/features/explorer/services/kafka-topic.service').KafkaTopicsResult>

    fetchKafkaTopicDetail(
        connectionId: string,
        topic: string,
    ): Promise<import('@/features/explorer/services/kafka-topic.service').KafkaTopicDetail>

    fetchKafkaMessages(
        connectionId: string,
        topic: string,
        options?: {
            partition?: number
            offset?: number
            limit?: number
            fromBeginning?: boolean
        },
    ): Promise<import('@/features/explorer/services/kafka-topic.service').KafkaMessagesResult>

    produceKafkaMessage(
        connectionId: string,
        topic: string,
        payload: { key?: string; value: string; partition?: number },
    ): Promise<import('@/features/explorer/services/kafka-topic.service').KafkaProduceResult>

    publishTableToKafka(
        connectionId: string,
        payload: import('@/features/explorer/services/kafka-topic.service').PublishTableToKafkaRequest,
        options?: { silent?: boolean },
    ): Promise<import('@/features/explorer/services/kafka-topic.service').PublishTableToKafkaResult>

    fetchKafkaConsumerGroups(
        connectionId: string,
        options?: { pattern?: string; limit?: number },
    ): Promise<import('@/features/explorer/services/kafka-topic.service').KafkaConsumerGroupsResult>

    fetchKafkaConsumerGroupMetrics(
        connectionId: string,
        groupId: string,
        options?: { topic?: string },
    ): Promise<import('@/features/explorer/services/kafka-topic.service').KafkaConsumerGroupMetrics>

    fetchConnection(connectionId: string): Promise<ConnectionConfig>

    connectConnection(connectionId: string): Promise<ConnectionTestResult>

    pingConnection(connectionId: string): Promise<ConnectionTestResult>

    disconnectConnection(connectionId: string): Promise<void>

    reconnectConnection(connectionId: string): Promise<ConnectionTestResult>

    createGroup(label: string, parentId?: string): Promise<ExplorerGroupResult>

    updateGroup(groupId: string, label: string): Promise<TreeNode[]>

    createConnection(config: ConnectionConfig, groupId?: string): Promise<ExplorerConnectionResult>

    updateConnection(connectionId: string, config: ConnectionConfig): Promise<TreeNode[]>

    moveConnection(connectionId: string, targetGroupId: string): Promise<TreeNode[]>

    deleteNode(nodeId: string): Promise<TreeNode[]>

    importConnections(configs: ConnectionConfig[]): Promise<ExplorerImportResult>
}

// ── Workspace (shortcut panel) ──────────────────────────────────────────────

export interface SaveInstanceSqlPayload {
    connectionId: string
    instanceId?: string
    instanceName?: string
    sql: string
    fileName?: string
}

export interface SaveInstanceSqlResult {
    relativePath: string
    fileName: string
    directory: string
}

export interface ReadInstanceSqlPayload {
    connectionId: string
    instanceName: string
    fileName?: string
}

export interface DeleteInstanceSqlPayload {
    connectionId: string
    instanceName: string
    fileName: string
}

export interface ReadInstanceSqlResult {
    sql: string
    fileName: string
    relativePath: string
}

export interface InstanceSqlFileItem {
    connectionId: string
    instanceName: string
    fileName: string
    relativePath: string
    modifiedAt: number
    preview: string
}

export interface ListInstanceSqlScriptsPayload {
    connectionId: string
    instanceName: string
    allConnections?: boolean
}

export interface RenameInstanceSqlPayload {
    connectionId: string
    instanceName: string
    oldFileName: string
    newFileName: string
}

export interface InstanceSqlHistoryEntry {
    versionId: string
    savedAt: number
    preview: string
    sizeBytes: number
}

export interface RestoreInstanceSqlHistoryPayload {
    connectionId: string
    instanceName: string
    fileName: string
    versionId: string
}

export interface ReadInstanceSqlHistoryPayload {
    connectionId: string
    instanceName: string
    fileName: string
    versionId: string
}

export interface SaveViewModelPayload {
    connectionId: string
    instanceId?: string
    instanceName?: string
    name: string
    sql: string
}

export interface SaveViewModelResult {
    relativePath: string
    name: string
    fileName: string
    directory: string
    draft?: boolean
}

export interface ReadViewModelPayload {
    connectionId: string
    instanceName: string
    name: string
}

export interface ReadViewModelResult {
    sql: string
    name: string
    fileName: string
    relativePath: string
    draft?: boolean
}

export interface ViewModelFileItem {
    connectionId: string
    instanceName: string
    name: string
    fileName: string
    relativePath: string
    modifiedAt: number
    preview: string
}

export interface ListViewModelsPayload {
    connectionId: string
    instanceName: string
}

export interface RenameViewModelPayload {
    connectionId: string
    instanceName: string
    oldName: string
    newName: string
}

export interface DeleteViewModelPayload {
    connectionId: string
    instanceName: string
    name: string
}

export interface WorkspaceSettings {
    scriptsDir: string
    scriptsDirResolved: string
}

export interface SlowSqlEntry {
    id: string
    sql: string
    connectionId?: string
    durationMs: number
    rowCount?: number
    executedAt: string
    teamShared?: boolean
}

export interface SqlStatsTrendPoint {
    date: string
    runCount: number
    avgDurationMs: number
    maxDurationMs: number
}

export interface SqlExecutionStats {
    slowQueries: SlowSqlEntry[]
    trend: SqlStatsTrendPoint[]
    totalRuns: number
    avgDurationMs: number
    slowThresholdMs: number
    days: number
}

export interface SqlStatsQuery {
    connectionId?: string
    days?: number
    limit?: number
    slowThresholdMs?: number
}

export interface WorkspaceApi {
    fetchSqlLogs(): Promise<SqlLogEntry[]>

    appendSqlLog(entry: Omit<SqlLogEntry, 'id'>, connectionId?: string): Promise<SqlLogEntry>

    fetchSavedConsoles(): Promise<SavedConsole[]>

    saveConsole(payload: {
        name: string
        connectionName: string
        sql: string
        folder?: string
        tags?: string[]
    }): Promise<SavedConsole>

    saveInstanceSql(payload: SaveInstanceSqlPayload): Promise<SaveInstanceSqlResult>

    readInstanceSql(payload: ReadInstanceSqlPayload): Promise<ReadInstanceSqlResult>

    readLatestInstanceSql(payload: Omit<ReadInstanceSqlPayload, 'fileName'>): Promise<ReadInstanceSqlResult>

    listInstanceSqlScripts(payload: ListInstanceSqlScriptsPayload): Promise<InstanceSqlFileItem[]>

    renameInstanceSql(payload: RenameInstanceSqlPayload): Promise<SaveInstanceSqlResult>

    deleteInstanceSql(payload: DeleteInstanceSqlPayload): Promise<void>

    listInstanceSqlHistory(payload: ReadInstanceSqlPayload): Promise<InstanceSqlHistoryEntry[]>

    readInstanceSqlHistoryVersion(payload: ReadInstanceSqlHistoryPayload): Promise<ReadInstanceSqlResult>

    restoreInstanceSqlHistory(payload: RestoreInstanceSqlHistoryPayload): Promise<ReadInstanceSqlResult>

    saveViewModel(payload: SaveViewModelPayload): Promise<SaveViewModelResult>

    saveViewModelDraft(payload: SaveViewModelPayload): Promise<SaveViewModelResult>

    readViewModel(payload: ReadViewModelPayload): Promise<ReadViewModelResult>

    listViewModels(payload: ListViewModelsPayload): Promise<ViewModelFileItem[]>

    renameViewModel(payload: RenameViewModelPayload): Promise<SaveViewModelResult>

    deleteViewModel(payload: DeleteViewModelPayload): Promise<void>

    fetchWorkspaceSettings(): Promise<WorkspaceSettings>

    fetchExportTasks(): Promise<ExportTask[]>

    createExportTask(
        fileName: string,
        options?: { clientCompleted?: boolean; fileSize?: number },
    ): Promise<ExportTask>

    fetchSqlStats(query?: SqlStatsQuery): Promise<SqlExecutionStats>
}

// ── Notifications ─────────────────────────────────────────────────────────

export interface NotificationPushInput {
    category: NotificationCategory
    titleKey: string
    bodyKey: string
    params?: Record<string, string | number>
}

export interface NotificationApi {
    fetchAll(): Promise<AppNotification[]>

    push(input: NotificationPushInput): Promise<AppNotification>

    markAllRead(): Promise<void>

    markRead(id: string): Promise<void>

    remove(id: string): Promise<void>

    clearRead(): Promise<void>

    clearAll(): Promise<void>
}

// ── Datasources ─────────────────────────────────────────────────────────────

export interface JdbcDriverResolveRequest {
    mavenCoordinates: string
    driverClass: string
}

export interface DatasourcesApi {
    list(): Promise<{
        datasources: DatasourceDefinition[]
        loadedPluginJars?: string[]
        pluginLoadFailures?: Array<{jarName: string; reason: string}>
    }>

    market(): Promise<{
        connectors: import('@/features/datasource/types/datasource.types').ConnectorMarketEntry[]
        loadedPluginJars?: string[]
        pluginLoadFailures?: Array<{jarName: string; reason: string}>
    }>

    resolveDriver(request: JdbcDriverResolveRequest): Promise<JdbcDriverResolveResult>
}

// ── Plugins & teams ─────────────────────────────────────────────────────────

export interface PluginApi {
    fetchAll(): Promise<PluginItem[]>
}

export interface TeamApi {
    fetchAll(): Promise<TeamSummary[]>

    create(name: string): Promise<TeamSummary>

    join(code: string): Promise<JoinTeamResult>

    fetchJoinRequests(): Promise<TeamJoinRequest[]>

    fetchMembers(teamId: string): Promise<TeamMember[]>

    updateMemberRole(teamId: string, userId: number, role: TeamMember['role']): Promise<TeamMember>

    fetchInvites(teamId: string): Promise<TeamInvite[]>

    approveInvite(teamId: string, inviteId: string): Promise<TeamSummary>

    rejectInvite(teamId: string, inviteId: string): Promise<TeamSummary>

    updateSettings(teamId: string, requireInviteApproval: boolean): Promise<TeamSummary>

    fetchAuditLogs(teamId: string, query?: TeamAuditLogQuery): Promise<TeamAuditLog[]>

    updateSharedConnections(
        teamId: string,
        connectionIds: string[],
        connectionAccess?: Record<string, 'readonly' | 'readwrite' | 'ddl' | 'read' | 'write'>,
    ): Promise<TeamSummary>

    updateOnCallConnections(teamId: string, connectionIds: string[]): Promise<TeamSummary>

    updateSharedConsoles(teamId: string, consoleIds: string[]): Promise<TeamSummary>

    updateShareSqlHistory(teamId: string, enabled: boolean): Promise<TeamSummary>

    fetchSharedAiSessions(teamId: string): Promise<TeamSharedAiSessionSummary[]>

    getSharedAiSession(teamId: string, sessionId: string): Promise<TeamSharedAiSessionDetail>

    shareAiSession(teamId: string, title: string, payloadJson: string): Promise<TeamSharedAiSessionSummary>

    fetchSharedQueries(teamId: string): Promise<TeamSharedQuerySummary[]>

    getSharedQuery(teamId: string, queryId: string): Promise<TeamSharedQueryDetail>

    shareQuery(teamId: string, payload: ShareTeamSharedQueryPayload): Promise<TeamSharedQuerySummary>

    updateSharedQuery(
        teamId: string,
        queryId: string,
        payload: ShareTeamSharedQueryPayload,
    ): Promise<TeamSharedQuerySummary>

    deleteSharedQuery(teamId: string, queryId: string): Promise<void>

    addSharedQueryComment(
        teamId: string,
        queryId: string,
        content: string,
    ): Promise<TeamSharedQueryComment>

    deleteSharedQueryComment(teamId: string, queryId: string, commentId: string): Promise<void>

    toggleSharedQueryFavorite(teamId: string, queryId: string): Promise<TeamSharedQuerySummary>

    fetchProductionApprovals(
        teamId: string,
        status?: TeamProductionApprovalSummary['status'],
    ): Promise<TeamProductionApprovalSummary[]>

    getProductionApproval(teamId: string, approvalId: string): Promise<TeamProductionApprovalDetail>

    submitProductionApproval(
        teamId: string,
        payload: SubmitTeamProductionApprovalPayload,
    ): Promise<TeamProductionApprovalSummary>

    approveProductionApproval(teamId: string, approvalId: string): Promise<TeamProductionApprovalDetail>

    rejectProductionApproval(
        teamId: string,
        approvalId: string,
        comment?: string,
    ): Promise<TeamProductionApprovalDetail>
}

// ── System ────────────────────────────────────────────────────────────────────

export interface SystemJvmMetrics {
    availableProcessors: number
    heapUsedBytes: number
    heapMaxBytes: number
    heapUsagePercent?: number | null
}

export interface SystemDatawiseMetrics {
    jdbcPoolsActive: number
    explorerSchemaSessionsActive: number
    explorerLoadChildrenNotModifiedShortCircuit: number
    explorerLoadChildrenNotModifiedAfterLoad: number
    explorerLoadChildrenModified: number
}

export interface SystemJdbcPoolMetrics {
    poolName: string
    connectionId: string
    activeConnections?: number | null
    idleConnections?: number | null
    pendingThreads?: number | null
    maxConnections?: number | null
    minConnections?: number | null
}

export interface SystemMetricsSnapshot {
    collectedAt: string
    healthStatus: string
    uptimeMs: number
    jvm: SystemJvmMetrics
    datawise: SystemDatawiseMetrics
    jdbcPools: SystemJdbcPoolMetrics[]
}

export interface SystemApi {
    ping(): Promise<HealthSnapshot>

    resolveEndpointLabel(): string

    fetchMetrics(): Promise<SystemMetricsSnapshot>
}

export interface ConfigApi {
    fetchAppConfig(): Promise<AppConfigFile | null>

    saveAppConfig(config: AppConfigFile): Promise<void>

    fetchAppConfigXml(): Promise<string>

    saveAppConfigXml(xml: string): Promise<void>

    fetchSqlSnippets(layer: 'shared' | 'personal'): Promise<SqlEditorShortcutsLayer | null>

    saveSqlSnippets(layer: 'shared' | 'personal', payload: SqlEditorShortcutsLayer): Promise<void>

    fetchUpdaterPreferences(): Promise<UpdatePreferences>

    saveUpdaterPreferences(prefs: UpdatePreferences): Promise<void>

    fetchConnectionsCatalog(): Promise<ConnectionsCatalog>

    saveConnectionsCatalog(catalog: ConnectionsCatalog): Promise<void>

    fetchConnectionsXml(): Promise<string>

    saveConnectionsXml(xml: string): Promise<void>
}

export interface MigrationTableCheckpoint {
    tableName: string
    status: string
    lastOffset: number
    rowsMigrated: number
    batchesCompleted: number
    lastWatermark?: string | null
    lastSeekKey?: string | null
    requestFingerprint?: string | null
    updatedAt?: string | null
}

export interface MigrationJobView {
    id: string
    status: string
    tablesPlanned: string[]
    tables: Record<string, MigrationTableCheckpoint>
    results: TableMigrationResult[]
    createdAt?: string | null
    updatedAt?: string | null
}

export interface MigrationApi {
    migrateTable(request: TableMigrationRequest): Promise<TableMigrationResult>

    migrateTablesBatch(request: TableMigrationBatchRequest): Promise<TableMigrationBatchResult>

    preflight(request: TableMigrationPreflightRequest): Promise<TableMigrationPreflightResult>

    getJob(jobId: string): Promise<MigrationJobView>

    startJob(request: TableMigrationBatchRequest): Promise<MigrationJobView>

    pauseJob(jobId: string): Promise<MigrationJobView>

    resumeJob(jobId: string): Promise<MigrationJobView>
}

// ── Platform ────────────────────────────────────────────────────────────────

export interface PlatformApi {
    listAnalysisCanvas(): Promise<AnalysisCanvasSummary[]>

    getAnalysisCanvas(id: string): Promise<AnalysisCanvasDetail>

    saveAnalysisCanvas(request: SaveAnalysisCanvasRequest): Promise<AnalysisCanvasDetail>

    deleteAnalysisCanvas(id: string): Promise<void>

    rerunAnalysisCanvas(request: RerunAnalysisCanvasRequest): Promise<RerunAnalysisCanvasResult>

    listSemanticMetrics(connectionId?: string, database?: string): Promise<SemanticMetric[]>

    saveSemanticMetric(request: SaveSemanticMetricRequest): Promise<SemanticMetric>

    deleteSemanticMetric(id: string): Promise<void>

    autoGenerateSemanticMetrics(request: AutoGenerateSemanticMetricsRequest): Promise<SemanticMetric[]>

    reviewSql(request: SqlReviewRequest): Promise<SqlReviewResult>

    listFederatedViews(): Promise<FederatedViewSummary[]>

    getFederatedView(id: string): Promise<FederatedViewDetail>

    saveFederatedView(request: SaveFederatedViewRequest): Promise<FederatedViewDetail>

    deleteFederatedView(id: string): Promise<void>

    executeFederatedView(request: ExecuteFederatedViewRequest): Promise<ExecuteSqlResult>

    generateFederatedSql(request: GenerateFederatedSqlRequest): Promise<GenerateFederatedSqlResult>

    listSchemaDriftMonitors(): Promise<SchemaDriftMonitor[]>

    saveSchemaDriftMonitor(request: SaveSchemaDriftMonitorRequest): Promise<SchemaDriftMonitor>

    deleteSchemaDriftMonitor(id: string): Promise<void>

    compareSchemaDrift(request: SchemaDriftCompareRequest): Promise<SchemaDriftReport>

    runSchemaDriftMonitor(id: string): Promise<SchemaDriftReport>

    listScheduledTasks(): Promise<ScheduledTask[]>

    saveScheduledTask(request: SaveScheduledTaskRequest): Promise<ScheduledTask>

    deleteScheduledTask(id: string): Promise<void>

    runScheduledTask(id: string): Promise<ScheduledTask>

    listQueryLibraryVersions(teamId: string, queryId: string): Promise<QueryLibraryVersion[]>

    saveQueryLibraryVersion(request: SaveQueryLibraryVersionRequest): Promise<QueryLibraryVersion>
}

// ── Client ──────────────────────────────────────────────────────────────────

export interface ApiClient {
    auth: AuthApi
    sql: SqlApi
    ai: AiApi
    datagen: DatagenApi
    tableData: TableDataApi
    tableDetail: TableDetailApi
    connection: ConnectionApi
    terminal: TerminalApi
    explorer: ExplorerApi
    workspace: WorkspaceApi
    notifications: NotificationApi
    plugins: PluginApi
    teams: TeamApi
    system: SystemApi
    config: ConfigApi
    datasources: DatasourcesApi
    migration: MigrationApi
    platform: PlatformApi
    lineage: import('@/shared/api/http/lineage').LineageApi
}
