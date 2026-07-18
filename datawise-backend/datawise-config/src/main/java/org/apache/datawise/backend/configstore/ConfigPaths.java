package org.apache.datawise.backend.configstore;

import org.apache.datawise.backend.domain.TenantIds;

/**
 * {@code config/} 目录下所有配置文件名（相对 config 根目录）。
 */
public final class ConfigPaths {

    public static final String APP = "app.xml";
    public static final String WORKSPACE = "workspace.xml";
    public static final String CONNECTIONS = "connections.xml";
    public static final String UPDATER = "updater.xml";
    public static final String SQL_SNIPPETS_SHARED = "sql-snippets.shared.xml";
    public static final String SQL_SNIPPETS_PERSONAL = "sql-snippets.personal.xml";

    public static final String USERS = "users.json";
    public static final String SESSIONS = "sessions.json";
    public static final String AUTH_SESSION_POLICY = "auth-session.json";
    public static final String API_TOKENS = "api-tokens.json";
    public static final String OIDC = "oidc.json";
    public static final String TEAMS = "teams.json";
    public static final String SQL_HISTORY = "sql-history.json";
    public static final String AI_KNOWLEDGE = "ai-knowledge.json";
    public static final String SAVED_CONSOLES = "saved-consoles.json";
    public static final String EXPORT_TASKS = "export-tasks.json";
    public static final String NOTIFICATIONS = "notifications.json";
    public static final String MIGRATION_JOBS = "migration/jobs.json";
    public static final String SHARES = "shares.json";

    public static final String SCHEMA_CACHE_DIR = "cache/schema";
    public static final String USERS_DIR = "users";
    public static final String TENANTS_DIR = "tenants";
    public static final String TENANTS_INDEX = TENANTS_DIR + "/index.json";

    public static String tenantDir(String tenantId) {
        return TENANTS_DIR + "/" + sanitizeScopeKey(tenantId);
    }

    public static String tenantMeta(String tenantId) {
        return tenantDir(tenantId) + "/tenant.json";
    }

    public static String tenantRoles(String tenantId) {
        return tenantDir(tenantId) + "/roles.json";
    }

    public static String tenantMemberships(String tenantId) {
        return tenantDir(tenantId) + "/memberships.json";
    }

    public static String tenantTeams(String tenantId) {
        return tenantDir(tenantId) + "/teams.json";
    }

    public static String tenantConnections(String tenantId) {
        return tenantDir(tenantId) + "/connections.xml";
    }

    public static String tenantOidc(String tenantId) {
        return tenantDir(tenantId) + "/oidc.json";
    }

    public static String tenantOutboundWebhooks(String tenantId) {
        return tenantDir(tenantId) + "/outbound-webhooks.json";
    }

    public static String tenantAiUsage(String tenantId) {
        return tenantDir(tenantId) + "/ai-usage.json";
    }

    /** Per-user schema tree snapshot ({@code cache/schema/u{userId}/t{tenantId}/{connectionId}.json}). */
    public static String userSchemaCache(long userId, String tenantId, String connectionId) {
        return SCHEMA_CACHE_DIR + "/u" + userId + "/t" + sanitizeScopeKey(tenantId)
                + "/" + sanitizeScopeKey(connectionId) + ".json";
    }

    /** @deprecated use {@link #userSchemaCache(long, String, String)} */
    @Deprecated
    public static String userSchemaCache(long userId, String connectionId) {
        return userSchemaCache(userId, TenantIds.DEFAULT, connectionId);
    }

    private ConfigPaths() {
    }

    public static String userDir(long userId) {
        return USERS_DIR + "/" + userId;
    }

    /** 用户 × 租户工作区目录（不含 app.xml）。 */
    public static String userTenantDir(long userId, String tenantId) {
        return userDir(userId) + "/tenants/" + sanitizeScopeKey(tenantId);
    }

    public static String userTenantFile(long userId, String tenantId, String fileName) {
        return userTenantDir(userId, tenantId) + "/" + fileName;
    }

    public static String userTenantScopeFile(long userId, String tenantId, String dirName, String scopeKey) {
        return userTenantDir(userId, tenantId) + "/" + dirName + "/" + sanitizeScopeKey(scopeKey) + ".json";
    }

    /** 用户全局偏好（主题/布局/LLM 等），不随租户切换。 */
    public static String userAppConfig(long userId) {
        return userDir(userId) + "/app.xml";
    }

    public static String userSqlSnippetsPersonal(long userId, String tenantId) {
        return userTenantFile(userId, tenantId, SQL_SNIPPETS_PERSONAL);
    }

    /** @deprecated use {@link #userSqlSnippetsPersonal(long, String)} */
    @Deprecated
    public static String userSqlSnippetsPersonal(long userId) {
        return userDir(userId) + "/" + SQL_SNIPPETS_PERSONAL;
    }

    public static String userAiKnowledge(long userId, String tenantId) {
        return userTenantFile(userId, tenantId, AI_KNOWLEDGE);
    }

    @Deprecated
    public static String userAiKnowledge(long userId) {
        return userDir(userId) + "/" + AI_KNOWLEDGE;
    }

    public static String userAnalysisCanvas(long userId, String tenantId) {
        return userTenantFile(userId, tenantId, "analysis-canvas.json");
    }

    @Deprecated
    public static String userAnalysisCanvas(long userId) {
        return userDir(userId) + "/analysis-canvas.json";
    }

    public static String userSemanticMetrics(long userId, String tenantId) {
        return userTenantFile(userId, tenantId, "semantic-metrics.json");
    }

    @Deprecated
    public static String userSemanticMetrics(long userId) {
        return userDir(userId) + "/semantic-metrics.json";
    }

    public static String userFederatedViews(long userId, String tenantId) {
        return userTenantFile(userId, tenantId, "federated-views.json");
    }

    @Deprecated
    public static String userFederatedViews(long userId) {
        return userDir(userId) + "/federated-views.json";
    }

    public static String userSchemaDriftMonitors(long userId, String tenantId) {
        return userTenantFile(userId, tenantId, "schema-drift-monitors.json");
    }

    @Deprecated
    public static String userSchemaDriftMonitors(long userId) {
        return userDir(userId) + "/schema-drift-monitors.json";
    }

    public static String userScheduledTasks(long userId, String tenantId) {
        return userTenantFile(userId, tenantId, "scheduled-tasks.json");
    }

    @Deprecated
    public static String userScheduledTasks(long userId) {
        return userDir(userId) + "/scheduled-tasks.json";
    }

    public static String userOutboundWebhooks(long userId) {
        return userDir(userId) + "/outbound-webhooks.json";
    }

    public static String userAiTableTags(long userId, String tenantId) {
        return userTenantFile(userId, tenantId, "ai-table-tags.json");
    }

    @Deprecated
    public static String userAiTableTags(long userId) {
        return userDir(userId) + "/ai-table-tags.json";
    }

    public static String userQueryLibraryVersions(long userId, String tenantId) {
        return userTenantFile(userId, tenantId, "query-library-versions.json");
    }

    @Deprecated
    public static String userQueryLibraryVersions(long userId) {
        return userDir(userId) + "/query-library-versions.json";
    }

    public static String userTableDataAuditDir(long userId, String tenantId) {
        return userTenantDir(userId, tenantId) + "/table-data-audit";
    }

    @Deprecated
    public static String userTableDataAuditDir(long userId) {
        return userDir(userId) + "/table-data-audit";
    }

    public static String userTableDataAuditScope(long userId, String tenantId, String scopeKey) {
        return userTenantScopeFile(userId, tenantId, "table-data-audit", scopeKey);
    }

    @Deprecated
    public static String userTableDataAuditScope(long userId, String scopeKey) {
        return userTableDataAuditDir(userId) + "/" + sanitizeScopeKey(scopeKey) + ".json";
    }

    public static String userSshScriptRecordsDir(long userId, String tenantId) {
        return userTenantDir(userId, tenantId) + "/ssh-script-records";
    }

    @Deprecated
    public static String userSshScriptRecordsDir(long userId) {
        return userDir(userId) + "/ssh-script-records";
    }

    public static String userSshScriptRecordsScope(long userId, String tenantId, String connectionId) {
        return userTenantScopeFile(userId, tenantId, "ssh-script-records", connectionId);
    }

    @Deprecated
    public static String userSshScriptRecordsScope(long userId, String connectionId) {
        return userSshScriptRecordsDir(userId) + "/" + sanitizeScopeKey(connectionId) + ".json";
    }

    public static String tenantSqlSnippetsShared(String tenantId) {
        return tenantDir(tenantId) + "/" + SQL_SNIPPETS_SHARED;
    }

    private static String sanitizeScopeKey(String value) {
        if (value == null || value.isBlank()) {
            return "default";
        }
        return value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
