package org.apache.datawise.backend.jdbc.execution;

import java.util.regex.Pattern;

/** 分页 SQL 公共预处理（去分号、判断是否可直接追加 LIMIT）。 */
public final class SqlPaginationClauseSupport {

    private static final Pattern LIMIT_PATTERN = Pattern.compile("\\blimit\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern OFFSET_PATTERN = Pattern.compile("\\boffset\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern FOR_UPDATE_PATTERN = Pattern.compile("\\bfor\\s+update\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern SET_OPERATION_PATTERN = Pattern.compile(
            "\\b(union|intersect|except)\\b",
            Pattern.CASE_INSENSITIVE
    );

    private SqlPaginationClauseSupport() {
    }

    public static String normalizeBody(String sql) {
        if (sql == null || sql.isBlank()) {
            throw new IllegalArgumentException("SQL is required");
        }
        String body = sql.trim();
        if (body.endsWith(";")) {
            body = body.substring(0, body.length() - 1).trim();
        }
        return body;
    }

    public static void validateLimitOffset(int limit, int offset) {
        if (limit <= 0) {
            throw new IllegalArgumentException("limit must be positive");
        }
        if (offset < 0) {
            throw new IllegalArgumentException("offset must be non-negative");
        }
    }

    public static String appendClause(String sql, String clause) {
        String body = normalizeBody(sql);
        if (canAppendLimitDirectly(body)) {
            return body + clause;
        }
        return "SELECT * FROM (" + body + ") AS _dw_page" + clause;
    }

    public static boolean canAppendLimitDirectly(String sql) {
        if (sql == null || sql.isBlank()) {
            return false;
        }
        if (LIMIT_PATTERN.matcher(sql).find()) {
            return false;
        }
        if (OFFSET_PATTERN.matcher(sql).find()) {
            return false;
        }
        if (FOR_UPDATE_PATTERN.matcher(sql).find()) {
            return false;
        }
        if (SET_OPERATION_PATTERN.matcher(sql).find()) {
            return false;
        }
        return true;
    }
}
