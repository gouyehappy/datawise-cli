package org.apache.datawise.backend.configstore;

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
    public static final String TEAMS = "teams.json";
    public static final String SQL_HISTORY = "sql-history.json";
    public static final String AI_KNOWLEDGE = "ai-knowledge.json";
    public static final String SAVED_CONSOLES = "saved-consoles.json";
    public static final String EXPORT_TASKS = "export-tasks.json";
    public static final String NOTIFICATIONS = "notifications.json";
    public static final String MIGRATION_JOBS = "migration/jobs.json";

    public static final String SCHEMA_CACHE_DIR = "cache/schema";
    public static final String USERS_DIR = "users";

    private ConfigPaths() {
    }

    public static String userAppConfig(long userId) {
        return USERS_DIR + "/" + userId + "/app.xml";
    }

    public static String userSqlSnippetsPersonal(long userId) {
        return USERS_DIR + "/" + userId + "/sql-snippets.personal.xml";
    }

    public static String userAiKnowledge(long userId) {
        return USERS_DIR + "/" + userId + "/ai-knowledge.json";
    }

    public static String userAnalysisCanvas(long userId) {
        return USERS_DIR + "/" + userId + "/analysis-canvas.json";
    }

    public static String userSemanticMetrics(long userId) {
        return USERS_DIR + "/" + userId + "/semantic-metrics.json";
    }

    public static String userFederatedViews(long userId) {
        return USERS_DIR + "/" + userId + "/federated-views.json";
    }

    public static String userSchemaDriftMonitors(long userId) {
        return USERS_DIR + "/" + userId + "/schema-drift-monitors.json";
    }

    public static String userScheduledTasks(long userId) {
        return USERS_DIR + "/" + userId + "/scheduled-tasks.json";
    }

    public static String userQueryLibraryVersions(long userId) {
        return USERS_DIR + "/" + userId + "/query-library-versions.json";
    }
}
