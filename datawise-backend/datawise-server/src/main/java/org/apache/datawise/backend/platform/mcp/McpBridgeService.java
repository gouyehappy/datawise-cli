package org.apache.datawise.backend.platform.mcp;

import org.apache.datawise.backend.database.drift.SchemaDriftService;
import org.apache.datawise.backend.database.sql.SqlReviewService;
import org.apache.datawise.backend.database.sql.SqlService;
import org.apache.datawise.backend.database.table.TableDetailService;
import org.apache.datawise.backend.domain.ExecuteSqlRequest;
import org.apache.datawise.backend.domain.SchemaDriftCompareRequest;
import org.apache.datawise.backend.domain.SchemaTablesResult;
import org.apache.datawise.backend.domain.SchemaTableSummary;
import org.apache.datawise.backend.domain.SqlReviewRequest;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.security.HeadlessSqlAuth;
import org.apache.datawise.backend.service.ConnectionVisibilityService;
import org.apache.datawise.backend.connector.api.support.SqlWriteClassifier;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class McpBridgeService {

    private final ConnectionVisibilityService connectionVisibilityService;
    private final TableDetailService tableDetailService;
    private final SqlService sqlService;
    private final SqlReviewService sqlReviewService;
    private final SchemaDriftService schemaDriftService;

    public McpBridgeService(
            ConnectionVisibilityService connectionVisibilityService,
            TableDetailService tableDetailService,
            SqlService sqlService,
            SqlReviewService sqlReviewService,
            SchemaDriftService schemaDriftService
    ) {
        this.connectionVisibilityService = connectionVisibilityService;
        this.tableDetailService = tableDetailService;
        this.sqlService = sqlService;
        this.sqlReviewService = sqlReviewService;
        this.schemaDriftService = schemaDriftService;
    }

    public record McpInvokeRequest(String tool, Map<String, Object> arguments) {
    }

    public List<Map<String, Object>> listTools() {
        return List.of(
                tool("list_connections", "List visible database connections"),
                tool("list_tables", "List tables for a connection/database", "connectionId", "database"),
                tool("review_sql", "Review SQL before execution", "sql", "connectionId", "database"),
                tool("execute_readonly_sql", "Execute read-only SELECT SQL", "sql", "connectionId", "database", "maxRows"),
                tool("compare_schema", "Compare schema drift between environments",
                        "sourceConnectionId", "sourceDatabase", "targetConnectionId", "targetDatabase")
        );
    }

    public Object invoke(McpInvokeRequest request) {
        if (request.tool() == null || request.tool().isBlank()) {
            throw new IllegalArgumentException("tool is required");
        }
        Map<String, Object> args = request.arguments() != null ? request.arguments() : Map.of();
        return switch (request.tool()) {
            case "list_connections" -> listConnections();
            case "list_tables" -> listTables(
                    stringArg(args, "connectionId"),
                    stringArg(args, "database")
            );
            case "review_sql" -> reviewSql(new SqlReviewRequest(
                    stringArg(args, "sql"),
                    stringArg(args, "connectionId"),
                    optionalString(args, "database")
            ));
            case "execute_readonly_sql" -> executeReadonly(new ExecuteSqlRequest(
                    stringArg(args, "sql"),
                    stringArg(args, "connectionId"),
                    optionalString(args, "database"),
                    intArg(args, "maxRows", 200),
                    null,
                    null,
                    null,
                    "mcp"
            ));
            case "compare_schema" -> compareSchema(new SchemaDriftCompareRequest(
                    stringArg(args, "sourceConnectionId"),
                    optionalString(args, "sourceDatabase"),
                    stringArg(args, "targetConnectionId"),
                    optionalString(args, "targetDatabase"),
                    optionalString(args, "tablePattern")
            ));
            default -> throw new IllegalArgumentException("unknown tool: " + request.tool());
        };
    }

    public List<Map<String, String>> listConnections() {
        HeadlessSqlAuth.requireSqlAccess();
        return connectionVisibilityService.visibleCatalogForCurrentUser().connections().stream()
                .map(this::toConnectionSummary)
                .toList();
    }

    public List<String> listTables(String connectionId, String database) {
        HeadlessSqlAuth.requireSqlAccess();
        SchemaTablesResult result = tableDetailService.loadSchemaTables(connectionId, database);
        return result.tables().stream().map(SchemaTableSummary::tableName).toList();
    }

    public Object reviewSql(SqlReviewRequest request) {
        HeadlessSqlAuth.requireSqlAccess();
        return sqlReviewService.review(request);
    }

    public Object executeReadonly(ExecuteSqlRequest request) {
        HeadlessSqlAuth.requireSqlAccess();
        if (SqlWriteClassifier.requiresWriteAccess(request.sql())) {
            throw new IllegalArgumentException("Only read-only SQL is allowed via MCP");
        }
        var review = sqlReviewService.review(new SqlReviewRequest(
                request.sql(),
                request.connectionId(),
                request.database()
        ));
        if (!review.allowed()) {
            throw new IllegalArgumentException("SQL blocked by review: " + review.findings());
        }
        return sqlService.execute(request);
    }

    public Object compareSchema(SchemaDriftCompareRequest request) {
        HeadlessSqlAuth.requireSqlAccess();
        return schemaDriftService.compare(request);
    }

    private Map<String, String> toConnectionSummary(ConnectionEntity connection) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("id", connection.getId());
        row.put("name", connection.getName());
        row.put("dbType", connection.getDbType());
        row.put("env", connection.getEnv());
        return row;
    }

    private static Map<String, Object> tool(String name, String description, String... params) {
        Map<String, Object> tool = new LinkedHashMap<>();
        tool.put("name", name);
        tool.put("description", description);
        tool.put("parameters", List.of(params));
        return tool;
    }

    private static String stringArg(Map<String, Object> args, String key) {
        Object value = args.get(key);
        if (value == null) {
            throw new IllegalArgumentException(key + " is required");
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            throw new IllegalArgumentException(key + " is required");
        }
        return text;
    }

    private static String optionalString(Map<String, Object> args, String key) {
        Object value = args.get(key);
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static int intArg(Map<String, Object> args, String key, int defaultValue) {
        Object value = args.get(key);
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        return Integer.parseInt(String.valueOf(value));
    }
}
