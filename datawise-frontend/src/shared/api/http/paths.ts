/** 后端 REST 路径集中定义，便于前后端对齐与维护 */
export const API_PATHS = {
    auth: {
        login: '/login',
        loginGuest: '/login/guest',
        signOut: '/signOut',
        session: '/api/auth/session',
        sessionPolicy: '/api/auth/session-policy',
        changePassword: '/api/auth/change-password',
    },
    admin: {
        users: '/api/admin/users',
        userPermissions: (userId: number) => `/api/admin/users/${userId}/permissions`,
    },
    sql: {
        execute: '/api/sql/execute',
        activeSessions: '/api/sql/active-sessions',
        lockWaits: '/api/sql/lock-waits',
        killSession: '/api/sql/kill-session',
        cancelExecution: '/api/sql/cancel-execution',
        sessionStatus: '/api/sql/session/status',
        sessionBegin: '/api/sql/session/begin',
        sessionAutocommit: '/api/sql/session/autocommit',
        sessionCommit: '/api/sql/session/commit',
        sessionRollback: '/api/sql/session/rollback',
        sessionClose: '/api/sql/session',
    },
    ai: {
        chat: '/api/ai/chat',
        analyzeStream: '/api/ai/analyze/stream',
        analyzeResume: '/api/ai/analyze/resume',
        sqlGenerate: '/api/ai/sql/generate',
        testConnection: '/api/ai/test-connection',
        testEmbedding: '/api/ai/test-embedding',
        knowledge: '/api/ai/knowledge',
    },
    datagen: {
        tablePreview: '/api/datagen/table/preview',
        tableExecute: '/api/datagen/table/execute',
    },
    tableData: (tableName: string, options?: { connectionId?: string; database?: string; maxRows?: number; cursorId?: string }) => {
        const base = `/api/tables/${encodeURIComponent(tableName)}/data`
        const params = new URLSearchParams()
        if (options?.connectionId) params.set('connectionId', options.connectionId)
        if (options?.database) params.set('database', options.database)
        if (options?.maxRows != null && options.maxRows > 0) params.set('maxRows', String(options.maxRows))
        if (options?.cursorId) params.set('cursorId', options.cursorId)
        const qs = params.toString()
        return qs ? `${base}?${qs}` : base
    },
    tableRows: (tableName: string) => `/api/tables/${encodeURIComponent(tableName)}/rows`,
    tableRowsDelete: (tableName: string) => `/api/tables/${encodeURIComponent(tableName)}/rows/delete`,
    tableRowsUpdate: (tableName: string) => `/api/tables/${encodeURIComponent(tableName)}/rows/update`,
    tableDataAudit: (
        tableName: string,
        options?: { connectionId?: string; database?: string; limit?: number },
    ) => {
        const base = `/api/tables/${encodeURIComponent(tableName)}/data/audit`
        const params = new URLSearchParams()
        if (options?.connectionId) params.set('connectionId', options.connectionId)
        if (options?.database) params.set('database', options.database)
        if (options?.limit != null && options.limit > 0) params.set('limit', String(options.limit))
        const qs = params.toString()
        return qs ? `${base}?${qs}` : base
    },
    tableDataAuditRestore: (tableName: string, auditId: string) =>
        `/api/tables/${encodeURIComponent(tableName)}/data/audit/${encodeURIComponent(auditId)}/restore`,
    tableProperties: (tableName: string, options?: { connectionId?: string; database?: string; kind?: 'table' | 'view' }) => {
        const base = `/api/tables/${encodeURIComponent(tableName)}/properties`
        const params = new URLSearchParams()
        if (options?.connectionId) params.set('connectionId', options.connectionId)
        if (options?.database) params.set('database', options.database)
        if (options?.kind && options.kind !== 'table') params.set('kind', options.kind)
        const qs = params.toString()
        return qs ? `${base}?${qs}` : base
    },
    tableDdl: (tableName: string, options?: { connectionId?: string; database?: string; kind?: 'table' | 'view' }) => {
        const base = `/api/tables/${encodeURIComponent(tableName)}/ddl`
        const params = new URLSearchParams()
        if (options?.connectionId) params.set('connectionId', options.connectionId)
        if (options?.database) params.set('database', options.database)
        if (options?.kind && options.kind !== 'table') params.set('kind', options.kind)
        const qs = params.toString()
        return qs ? `${base}?${qs}` : base
    },
    tableRelations: (tableName: string, options?: { connectionId?: string; database?: string }) => {
        const base = `/api/tables/${encodeURIComponent(tableName)}/relations`
        const params = new URLSearchParams()
        if (options?.connectionId) params.set('connectionId', options.connectionId)
        if (options?.database) params.set('database', options.database)
        const qs = params.toString()
        return qs ? `${base}?${qs}` : base
    },
    schemaRelations: (options?: { connectionId?: string; database?: string }) => {
        const base = '/api/schema/relations'
        const params = new URLSearchParams()
        if (options?.connectionId) params.set('connectionId', options.connectionId)
        if (options?.database) params.set('database', options.database)
        const qs = params.toString()
        return qs ? `${base}?${qs}` : base
    },
    schemaTables: (options?: { connectionId?: string; database?: string }) => {
        const base = '/api/schema/tables'
        const params = new URLSearchParams()
        if (options?.connectionId) params.set('connectionId', options.connectionId)
        if (options?.database) params.set('database', options.database)
        const qs = params.toString()
        return qs ? `${base}?${qs}` : base
    },
    tableExportSql: (
        tableName: string,
        options?: { connectionId?: string; database?: string; includeData?: boolean; maxRows?: number },
    ) => {
        const base = `/api/tables/${encodeURIComponent(tableName)}/export-sql`
        const params = new URLSearchParams()
        if (options?.connectionId) params.set('connectionId', options.connectionId)
        if (options?.database) params.set('database', options.database)
        if (options?.includeData) params.set('includeData', 'true')
        if (options?.maxRows != null && options.maxRows > 0) params.set('maxRows', String(options.maxRows))
        const qs = params.toString()
        return qs ? `${base}?${qs}` : base
    },
    databaseExportSql: (options?: {
        connectionId?: string
        database?: string
        includeData?: boolean
        maxRows?: number
    }) => {
        const base = '/api/export-sql/database'
        const params = new URLSearchParams()
        if (options?.connectionId) params.set('connectionId', options.connectionId)
        if (options?.database) params.set('database', options.database)
        if (options?.includeData) params.set('includeData', 'true')
        if (options?.maxRows != null && options.maxRows > 0) params.set('maxRows', String(options.maxRows))
        const qs = params.toString()
        return qs ? `${base}?${qs}` : base
    },
    databaseMetadocPreview: (options?: {
        connectionId?: string
        database?: string
        format?: string
        includeDetails?: boolean
    }) => {
        const base = '/api/export-metadoc/database/preview'
        const params = new URLSearchParams()
        if (options?.connectionId) params.set('connectionId', options.connectionId)
        if (options?.database) params.set('database', options.database)
        if (options?.format) params.set('format', options.format)
        if (options?.includeDetails != null) params.set('includeDetails', String(options.includeDetails))
        const qs = params.toString()
        return qs ? `${base}?${qs}` : base
    },
    migration: {
        table: '/api/migration/table',
        batch: '/api/migration/batch',
        tablesBatch: '/api/migration/tables/batch',
        tablesBatchStream: '/api/migration/tables/batch/stream',
        preflight: '/api/migration/preflight',
        jobs: '/api/migration/jobs',
        job: (id: string) => `/api/migration/jobs/${encodeURIComponent(id)}`,
        jobPause: (id: string) => `/api/migration/jobs/${encodeURIComponent(id)}/pause`,
        jobResume: (id: string) => `/api/migration/jobs/${encodeURIComponent(id)}/resume`,
        jobStream: (id: string) => `/api/migration/jobs/${encodeURIComponent(id)}/stream`,
    },
    connection: {
        test: '/api/connections/test',
    },
    terminal: {
        execute: '/api/terminal/execute',
        welcome: '/api/terminal/welcome',
        status: '/api/terminal/status',
    },
    explorer: {
        tree: '/api/explorer/tree',
        groups: '/api/explorer/groups',
        group: (id: string) => `/api/explorer/groups/${encodeURIComponent(id)}`,
        connections: '/api/explorer/connections',
        connection: (id: string) => `/api/explorer/connections/${encodeURIComponent(id)}`,
        connectionGroup: (id: string) =>
            `/api/explorer/connections/${encodeURIComponent(id)}/group`,
        connectConnection: (id: string) =>
            `/api/explorer/connections/${encodeURIComponent(id)}/connect`,
        disconnectConnection: (id: string) =>
            `/api/explorer/connections/${encodeURIComponent(id)}/disconnect`,
        reconnectConnection: (id: string) =>
            `/api/explorer/connections/${encodeURIComponent(id)}/reconnect`,
        pooledConnections: '/api/explorer/connections/pooled',
        pingConnection: (id: string) =>
            `/api/explorer/connections/${encodeURIComponent(id)}/ping`,
        nodeChildren: (connectionId: string, nodeId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/nodes/${encodeURIComponent(nodeId)}/children`,
        importConnections: '/api/explorer/connections/import',
        node: (id: string) => `/api/explorer/nodes/${encodeURIComponent(id)}`,
        redisKey: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/redis/key`,
        redisKeys: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/redis/keys`,
        redisCommand: (connectionId: string, database?: number) => {
            const base = `/api/explorer/connections/${encodeURIComponent(connectionId)}/redis/command`
            if (database == null) return base
            return `${base}?database=${encodeURIComponent(String(database))}`
        },
        kafkaTopics: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/kafka/topics`,
        kafkaTopic: (connectionId: string, topic: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/kafka/topics/${encodeURIComponent(topic)}`,
        kafkaMessages: (connectionId: string, topic: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/kafka/topics/${encodeURIComponent(topic)}/messages`,
        kafkaProduce: (connectionId: string, topic: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/kafka/topics/${encodeURIComponent(topic)}/messages`,
        kafkaPublishTable: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/kafka/publish-table`,
        kafkaConsumerGroups: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/kafka/consumer-groups`,
        kafkaConsumerGroupMetrics: (connectionId: string, groupId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/kafka/consumer-groups/${encodeURIComponent(groupId)}/metrics`,
        yarnInfo: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/yarn/info`,
        yarnApps: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/yarn/apps`,
        yarnApp: (connectionId: string, appId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/yarn/apps/${encodeURIComponent(appId)}`,
        yarnNodes: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/yarn/nodes`,
        yarnQueues: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/yarn/queues`,
        yarnKillApp: (connectionId: string, appId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/yarn/apps/${encodeURIComponent(appId)}/state`,
        yarnMoveAppQueue: (connectionId: string, appId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/yarn/apps/${encodeURIComponent(appId)}/queue`,
        yarnRemoveQueue: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/yarn/queues/remove`,
        createDatabase: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/databases`,
        deleteDatabase: (connectionId: string, name: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/databases/${encodeURIComponent(name)}`,
        createSchema: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/schemas`,
        mysqlCharsets: (connectionId: string) =>
            `/api/explorer/connections/${encodeURIComponent(connectionId)}/mysql/charsets`,
    },
    workspace: {
        sqlLogs: '/api/workspace/sql-logs',
        sqlStats: '/api/workspace/sql-stats',
        savedConsoles: '/api/workspace/saved-consoles',
        instanceSql: '/api/workspace/instance-sql',
        instanceSqlScripts: '/api/workspace/instance-sql/scripts',
        instanceSqlRename: '/api/workspace/instance-sql/rename',
        instanceSqlLatest: '/api/workspace/instance-sql/latest',
        instanceSqlHistory: '/api/workspace/instance-sql/history',
        instanceSqlHistoryVersion: '/api/workspace/instance-sql/history/version',
        instanceSqlHistoryRestore: '/api/workspace/instance-sql/history/restore',
        viewModels: '/api/workspace/view-models',
        viewModelsDraft: '/api/workspace/view-models/draft',
        viewModelsScripts: '/api/workspace/view-models/scripts',
        viewModelsRename: '/api/workspace/view-models/rename',
        settings: '/api/workspace/settings',
        exportTasks: '/api/workspace/export-tasks',
    },
    notifications: {
        list: '/api/notifications',
        readAll: '/api/notifications/read-all',
        read: (id: string) => `/api/notifications/${encodeURIComponent(id)}/read`,
        item: (id: string) => `/api/notifications/${encodeURIComponent(id)}`,
        clearRead: '/api/notifications/clear-read',
        clearAll: '/api/notifications?all=true',
    },
    plugins: '/api/plugins',
    datasources: {
        list: '/api/datasources',
        market: '/api/datasources/market',
        resolveDriver: '/api/datasources/drivers/resolve',
    },
    health: '/api/health',
    metrics: '/api/system/metrics',
    lineage: {
        viewModels: '/api/lineage/view-models',
        parse: '/api/lineage/view-models/parse',
        impact: '/api/lineage/view-models/impact',
    },
    config: {
        app: '/api/config/app',
        appXml: '/api/config/app.xml',
        sqlSnippets: (layer: 'shared' | 'personal') =>
            `/api/config/sql-snippets/${layer}`,
        updater: '/api/config/updater',
        connections: '/api/config/connections',
        connectionsXml: '/api/config/connections.xml',
    },
    teams: {
        list: '/api/teams',
        create: '/api/teams',
        join: '/api/teams/join',
        joinRequests: '/api/teams/join-requests',
        members: (teamId: string) => `/api/teams/${encodeURIComponent(teamId)}/members`,
        memberRole: (teamId: string, userId: number) =>
            `/api/teams/${encodeURIComponent(teamId)}/members/${userId}/role`,
        invites: (teamId: string) => `/api/teams/${encodeURIComponent(teamId)}/invites`,
        approveInvite: (teamId: string, inviteId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/invites/${encodeURIComponent(inviteId)}/approve`,
        rejectInvite: (teamId: string, inviteId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/invites/${encodeURIComponent(inviteId)}/reject`,
        settings: (teamId: string) => `/api/teams/${encodeURIComponent(teamId)}/settings`,
        auditLogs: (teamId: string) => `/api/teams/${encodeURIComponent(teamId)}/audit-logs`,
        sharedConnections: (teamId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/shared-connections`,
        onCallConnections: (teamId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/on-call-connections`,
        sharedConsoles: (teamId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/shared-consoles`,
        shareSqlHistory: (teamId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/share-sql-history`,
        aiSessions: (teamId: string) => `/api/teams/${encodeURIComponent(teamId)}/ai-sessions`,
        aiSession: (teamId: string, sessionId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/ai-sessions/${encodeURIComponent(sessionId)}`,
        sharedQueries: (teamId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/shared-queries`,
        sharedQuery: (teamId: string, queryId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/shared-queries/${encodeURIComponent(queryId)}`,
        sharedQueryStream: (teamId: string, queryId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/shared-queries/${encodeURIComponent(queryId)}/stream`,
        sharedQueryComment: (teamId: string, queryId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/shared-queries/${encodeURIComponent(queryId)}/comments`,
        sharedQueryCommentById: (teamId: string, queryId: string, commentId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/shared-queries/${encodeURIComponent(queryId)}/comments/${encodeURIComponent(commentId)}`,
        sharedQueryFavorite: (teamId: string, queryId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/shared-queries/${encodeURIComponent(queryId)}/favorite`,
        productionApprovals: (teamId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/production-approvals`,
        productionApproval: (teamId: string, approvalId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/production-approvals/${encodeURIComponent(approvalId)}`,
        productionApprovalApprove: (teamId: string, approvalId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/production-approvals/${encodeURIComponent(approvalId)}/approve`,
        productionApprovalReject: (teamId: string, approvalId: string) =>
            `/api/teams/${encodeURIComponent(teamId)}/production-approvals/${encodeURIComponent(approvalId)}/reject`,
    },
    aiRag: {
        status: '/api/ai/rag/status',
        rebuild: '/api/ai/rag/rebuild',
    },
    aiPython: {
        runtime: '/api/ai/python/runtime',
    },
    aiSchema: {
        tables: '/api/ai/schema/tables',
    },
    aiTableTags: {
        list: '/api/ai/table-tags',
        catalog: '/api/ai/table-tags/catalog',
    },
    platform: {
        analysisCanvas: '/api/platform/analysis-canvas',
        analysisCanvasRerun: '/api/platform/analysis-canvas/rerun',
        semanticMetrics: '/api/platform/semantic-metrics',
        semanticMetricsAutoGenerate: '/api/platform/semantic-metrics/auto-generate',
        sqlReview: '/api/platform/sql-review',
        federatedViews: '/api/platform/federated-views',
        federatedViewsExecute: '/api/platform/federated-views/execute',
        federatedViewsGenerateSql: '/api/platform/federated-views/generate-sql',
        schemaDriftMonitors: '/api/platform/schema-drift/monitors',
        schemaDriftCompare: '/api/platform/schema-drift/compare',
        schemaDriftMonitorRun: (id: string) =>
            `/api/platform/schema-drift/monitors/${encodeURIComponent(id)}/run`,
        scheduledTasks: '/api/platform/scheduled-tasks',
        scheduledTaskRun: (id: string) =>
            `/api/platform/scheduled-tasks/${encodeURIComponent(id)}/run`,
        queryLibraryVersions: (teamId: string, queryId: string) =>
            `/api/platform/query-library/${encodeURIComponent(teamId)}/${encodeURIComponent(queryId)}/versions`,
        queryLibrarySaveVersion: '/api/platform/query-library/versions',
    },
    ssh: {
        scriptRecords: (connectionId: string) =>
            `/api/ssh/script-records?connectionId=${encodeURIComponent(connectionId)}`,
        scriptRecordsSave: '/api/ssh/script-records',
        scriptRecordDelete: (connectionId: string, recordId: string) =>
            `/api/ssh/script-records/${encodeURIComponent(recordId)}?connectionId=${encodeURIComponent(connectionId)}`,
    },
} as const
