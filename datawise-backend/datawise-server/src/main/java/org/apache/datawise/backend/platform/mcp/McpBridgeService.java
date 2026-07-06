package org.apache.datawise.backend.platform.mcp;

import org.apache.datawise.backend.ai.canvas.AnalysisCanvasService;
import org.apache.datawise.backend.ai.semantic.SemanticLayerService;
import org.apache.datawise.backend.ai.tag.AiTableTagService;
import org.apache.datawise.backend.database.drift.SchemaDriftService;
import org.apache.datawise.backend.platform.sql.SqlReviewOrchestrator;
import org.apache.datawise.backend.database.sql.SqlService;
import org.apache.datawise.backend.database.table.TableDetailService;
import org.apache.datawise.backend.domain.ExecuteSqlRequest;
import org.apache.datawise.backend.ai.federated.FederatedSqlGeneratorService;
import org.apache.datawise.backend.domain.GenerateFederatedSqlRequest;
import org.apache.datawise.backend.domain.RerunAnalysisCanvasRequest;
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
    private final SqlReviewOrchestrator sqlReviewOrchestrator;
    private final SchemaDriftService schemaDriftService;
    private final AiTableTagService tableTagService;
    private final SemanticLayerService semanticLayerService;
    private final AnalysisCanvasService analysisCanvasService;
    private final FederatedSqlGeneratorService federatedSqlGeneratorService;

    public McpBridgeService(
            ConnectionVisibilityService connectionVisibilityService,
            TableDetailService tableDetailService,
            SqlService sqlService,
            SqlReviewOrchestrator sqlReviewOrchestrator,
            SchemaDriftService schemaDriftService,
            AiTableTagService tableTagService,
            SemanticLayerService semanticLayerService,
            AnalysisCanvasService analysisCanvasService,
            FederatedSqlGeneratorService federatedSqlGeneratorService
    ) {
        this.connectionVisibilityService = connectionVisibilityService;
        this.tableDetailService = tableDetailService;
        this.sqlService = sqlService;
        this.sqlReviewOrchestrator = sqlReviewOrchestrator;
        this.schemaDriftService = schemaDriftService;
        this.tableTagService = tableTagService;
        this.semanticLayerService = semanticLayerService;
        this.analysisCanvasService = analysisCanvasService;
        this.federatedSqlGeneratorService = federatedSqlGeneratorService;
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
                        "sourceConnectionId", "sourceDatabase", "targetConnectionId", "targetDatabase"),
                tool("list_semantic_metrics", "List semantic layer metrics for a database",
                        "connectionId", "database"),
                tool("rerun_canvas", "Rerun an analysis canvas with parameter values",
                        "canvasId", "parameterValues"),
                tool("generate_federated_sql", "Generate cross-source federated SQL from natural language",
                        "prompt", "sources")
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
            case "list_semantic_metrics" -> listSemanticMetrics(
                    stringArg(args, "connectionId"),
                    stringArg(args, "database")
            );
            case "rerun_canvas" -> rerunCanvas(
                    stringArg(args, "canvasId"),
                    args.get("parameterValues")
            );
            case "generate_federated_sql" -> generateFederatedSql(args);
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
        List<String> allTables = result.tables().stream().map(SchemaTableSummary::tableName).toList();
        return tableTagService.filterTaggedTables(connectionId, database, allTables);
    }

    public Object reviewSql(SqlReviewRequest request) {
        HeadlessSqlAuth.requireSqlAccess();
        return sqlReviewOrchestrator.review(request);
    }

    public Object executeReadonly(ExecuteSqlRequest request) {
        HeadlessSqlAuth.requireSqlAccess();
        if (SqlWriteClassifier.requiresWriteAccess(request.sql())) {
            throw new IllegalArgumentException("Only read-only SQL is allowed via MCP");
        }
        var review = sqlReviewOrchestrator.review(new SqlReviewRequest(
                request.sql(),
                request.connectionId(),
                request.database(),
                false
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

    public Object listSemanticMetrics(String connectionId, String database) {
        HeadlessSqlAuth.requireSqlAccess();
        return semanticLayerService.list(connectionId, database);
    }

    @SuppressWarnings("unchecked")
    public Object rerunCanvas(String canvasId, Object parameterValuesRaw) {
        HeadlessSqlAuth.requireSqlAccess();
        Map<String, String> values = Map.of();
        if (parameterValuesRaw instanceof Map<?, ?> raw) {
            values = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : raw.entrySet()) {
                if (entry.getKey() != null && entry.getValue() != null) {
                    values.put(String.valueOf(entry.getKey()), String.valueOf(entry.getValue()));
                }
            }
        }
        return analysisCanvasService.rerun(new RerunAnalysisCanvasRequest(canvasId, values));
    }

    @SuppressWarnings("unchecked")
    public Object generateFederatedSql(Map<String, Object> args) {
        HeadlessSqlAuth.requireSqlAccess();
        String prompt = stringArg(args, "prompt");
        Object sourcesRaw = args.get("sources");
        if (!(sourcesRaw instanceof List<?> list) || list.size() < 2) {
            throw new IllegalArgumentException("sources must be an array with at least two entries");
        }
        List<org.apache.datawise.backend.model.FederatedViewSource> sources = new java.util.ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> map)) {
                continue;
            }
            org.apache.datawise.backend.model.FederatedViewSource source =
                    new org.apache.datawise.backend.model.FederatedViewSource();
            source.setAlias(stringArg((Map<String, Object>) map, "alias"));
            source.setConnectionId(stringArg((Map<String, Object>) map, "connectionId"));
            Object database = map.get("database");
            if (database != null) {
                source.setDatabase(String.valueOf(database));
            }
            sources.add(source);
        }
        return federatedSqlGeneratorService.generate(new GenerateFederatedSqlRequest(prompt, sources));
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
