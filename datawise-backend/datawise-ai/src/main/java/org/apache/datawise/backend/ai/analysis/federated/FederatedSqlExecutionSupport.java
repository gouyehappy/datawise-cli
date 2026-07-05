package org.apache.datawise.backend.ai.analysis.federated;

import org.apache.datawise.backend.ai.analysis.graph.nodes.AnalysisNodeSupport;
import org.apache.datawise.backend.common.SqlExecutionException;
import org.apache.datawise.backend.ai.domain.AiChatRequest;
import org.apache.datawise.backend.ai.domain.AiDatabaseTargetDto;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.backend.database.sql.SqlService;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 多数据源：在各 target 上执行同一 SQL 并合并结果（附加 __dw_source__ 列）
 */
@Component
public class FederatedSqlExecutionSupport {

    public static final String SOURCE_COLUMN = "__dw_source__";

    private final SqlService sqlService;

    public FederatedSqlExecutionSupport(SqlService sqlService) {
        this.sqlService = sqlService;
    }

    public ExecuteSqlResult executeFederated(AiChatRequest request, String sql, int maxRows) throws SqlExecutionException {
        List<AiDatabaseTargetDto> targets = executableTargets(request);
        if (targets.size() <= 1) {
            AiDatabaseTargetDto primary = targets.isEmpty()
                    ? AnalysisNodeSupport.resolvePrimaryTarget(request.targets())
                    : targets.get(0);
            return sqlService.execute(
                    sql,
                    primary.connectionId(),
                    resolveDatabase(primary),
                    maxRows,
                    null
            );
        }

        List<Map<String, Object>> mergedColumns = null;
        List<Map<String, Object>> mergedRows = new ArrayList<>();
        long totalDuration = 0L;
        int totalRows = 0;

        for (AiDatabaseTargetDto target : targets) {
            String label = formatSourceLabel(target);
            ExecuteSqlResult partial = sqlService.execute(
                    sql,
                    target.connectionId(),
                    resolveDatabase(target),
                    maxRows,
                    null
            );
            totalDuration += partial.durationMs();
            totalRows += partial.rowCount();
            if (mergedColumns == null) {
                mergedColumns = prependSourceColumn(partial.columns());
            }
            for (Map<String, Object> row : partial.rows()) {
                Map<String, Object> copy = new LinkedHashMap<>(row);
                copy.put(SOURCE_COLUMN, label);
                mergedRows.add(copy);
            }
        }

        return new ExecuteSqlResult(
                sql,
                totalRows,
                totalDuration,
                mergedColumns != null ? mergedColumns : List.of(),
                mergedRows,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    private static List<AiDatabaseTargetDto> executableTargets(AiChatRequest request) {
        List<AiDatabaseTargetDto> picked = new ArrayList<>();
        if (request.targets() == null) {
            return picked;
        }
        for (AiDatabaseTargetDto target : request.targets()) {
            if (target != null && target.connectionId() != null && !target.connectionId().isBlank()) {
                picked.add(target);
            }
        }
        return picked;
    }

    private static List<Map<String, Object>> prependSourceColumn(List<Map<String, Object>> columns) {
        List<Map<String, Object>> next = new ArrayList<>();
        Map<String, Object> sourceCol = new LinkedHashMap<>();
        sourceCol.put("name", SOURCE_COLUMN);
        sourceCol.put("key", SOURCE_COLUMN);
        next.add(sourceCol);
        if (columns != null) {
            Set<String> seen = new LinkedHashSet<>();
            seen.add(SOURCE_COLUMN);
            for (Map<String, Object> column : columns) {
                Object keyObj = column.get("key") != null ? column.get("key") : column.get("name");
                String key = keyObj != null ? String.valueOf(keyObj) : null;
                if (key != null && !seen.contains(key)) {
                    next.add(column);
                    seen.add(key);
                }
            }
        }
        return next;
    }

    private static String resolveDatabase(AiDatabaseTargetDto target) {
        if (target.database() != null && !target.database().isBlank()) {
            return target.database();
        }
        return target.databaseLabel();
    }

    private static String formatSourceLabel(AiDatabaseTargetDto target) {
        String db = resolveDatabase(target);
        String conn = target.connectionLabel() != null && !target.connectionLabel().isBlank()
                ? target.connectionLabel()
                : target.connectionId();
        return db != null && !db.isBlank() ? conn + "/" + db : conn;
    }
}
