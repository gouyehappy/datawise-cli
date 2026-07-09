package org.apache.datawise.backend.ai.support;

import org.apache.datawise.sqlparser.support.SqlTextSupport;

import java.util.List;
import java.util.Locale;

/**
 * 将 LLM 输出规范为单条可执行 SQL（去围栏、去前言、取第一条语句）
 */
final class AiSqlNormalizer {

    private AiSqlNormalizer() {
    }

    static String normalize(String sql) {
        if (sql == null || sql.isBlank()) {
            return "";
        }
        String trimmed = AiLlmGateway.stripCodeFence(sql).trim();
        trimmed = dropLeadingNonSql(trimmed);
        return firstStatement(trimmed).trim();
    }

    private static String dropLeadingNonSql(String sql) {
        String[] lines = sql.split("\n", -1);
        StringBuilder kept = new StringBuilder();
        boolean started = false;
        for (String line : lines) {
            if (!started) {
                String lineTrimmed = line.trim();
                if (lineTrimmed.isEmpty()) {
                    continue;
                }
                if (!isSqlStartLine(lineTrimmed)) {
                    continue;
                }
                started = true;
            }
            kept.append(line).append('\n');
        }
        return kept.toString().trim();
    }

    private static boolean isSqlStartLine(String line) {
        if (line.startsWith("--")) {
            return true;
        }
        String upper = line.toUpperCase(Locale.ROOT);
        return upper.startsWith("SELECT") || upper.startsWith("WITH");
    }

    static String firstStatement(String sql) {
        return SqlTextSupport.firstStatement(sql);
    }

    static List<String> splitStatements(String sql) {
        return SqlTextSupport.splitStatements(sql);
    }
}
