package org.apache.datawise.backend.ai.support;

import java.util.ArrayList;
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
        if (sql == null || sql.isBlank()) {
            return "";
        }
        List<String> statements = splitStatements(sql);
        return statements.isEmpty() ? sql.trim() : statements.get(0);
    }

    static List<String> splitStatements(String sql) {
        List<String> statements = new ArrayList<>();
        int start = 0;
        for (int i = 0; i < sql.length(); i++) {
            if (sql.charAt(i) != ';') {
                continue;
            }
            if (!isSemicolonInCode(sql, i)) {
                continue;
            }
            String piece = sql.substring(start, i).trim();
            if (!piece.isEmpty()) {
                statements.add(piece);
            }
            start = i + 1;
        }
        String tail = sql.substring(start).trim();
        if (!tail.isEmpty()) {
            statements.add(tail);
        }
        return statements;
    }

    private static boolean isSemicolonInCode(String sql, int index) {
        boolean inSingle = false;
        boolean inDouble = false;
        boolean inBacktick = false;
        boolean inLineComment = false;
        boolean inBlockComment = false;

        for (int i = 0; i < index; i++) {
            char ch = sql.charAt(i);
            char next = i + 1 < sql.length() ? sql.charAt(i + 1) : '\0';

            if (inLineComment) {
                if (ch == '\n') {
                    inLineComment = false;
                }
                continue;
            }
            if (inBlockComment) {
                if (ch == '*' && next == '/') {
                    inBlockComment = false;
                    i++;
                }
                continue;
            }
            if (inSingle) {
                if (ch == '\'' && sql.charAt(i - 1) != '\\') {
                    inSingle = false;
                }
                continue;
            }
            if (inDouble) {
                if (ch == '"' && sql.charAt(i - 1) != '\\') {
                    inDouble = false;
                }
                continue;
            }
            if (inBacktick) {
                if (ch == '`') {
                    inBacktick = false;
                }
                continue;
            }

            if (ch == '-' && next == '-') {
                inLineComment = true;
                i++;
                continue;
            }
            if (ch == '/' && next == '*') {
                inBlockComment = true;
                i++;
                continue;
            }
            if (ch == '\'') {
                inSingle = true;
                continue;
            }
            if (ch == '"') {
                inDouble = true;
                continue;
            }
            if (ch == '`') {
                inBacktick = true;
            }
        }

        return !inSingle && !inDouble && !inBacktick && !inLineComment && !inBlockComment;
    }
}
