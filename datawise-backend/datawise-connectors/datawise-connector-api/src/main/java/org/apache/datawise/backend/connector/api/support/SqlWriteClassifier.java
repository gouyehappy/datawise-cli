package org.apache.datawise.backend.connector.api.support;

import org.apache.datawise.sqlparser.SqlTransformOps;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 判断 SQL 是否需要写权限（DML/DDL/事务控制等）。
 */
public final class SqlWriteClassifier {

    private static final Pattern DDL = Pattern.compile(
            "\\b(CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\\b",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern FORBIDDEN = Pattern.compile(
            "\\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|MERGE|GRANT|REVOKE|CALL|EXEC)\\b",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern SESSION_MUTATING = Pattern.compile(
            "\\b(BEGIN|COMMIT|ROLLBACK|START\\s+TRANSACTION)\\b",
            Pattern.CASE_INSENSITIVE
    );

    private SqlWriteClassifier() {
    }

    public static boolean requiresDdlAccess(String sql) {
        if (sql == null || sql.isBlank()) {
            return false;
        }
        String stripped = stripSqlComments(sql).trim();
        return !stripped.isEmpty() && DDL.matcher(stripped).find();
    }

    public static boolean requiresWriteAccess(String sql) {
        if (sql == null || sql.isBlank()) {
            return false;
        }
        String stripped = stripSqlComments(sql).trim();
        if (stripped.isEmpty()) {
            return false;
        }
        if (SESSION_MUTATING.matcher(stripped).find()) {
            return true;
        }
        if (FORBIDDEN.matcher(stripped).find()) {
            return true;
        }
        String upper = stripped.toUpperCase(Locale.ROOT);
        return !upper.startsWith("SELECT")
                && !upper.startsWith("WITH")
                && !upper.startsWith("SHOW")
                && !upper.startsWith("DESCRIBE")
                && !upper.startsWith("DESC")
                && !upper.startsWith("EXPLAIN")
                && !upper.startsWith("USE ");
    }

    /**
     * B-03: DROP / TRUNCATE / DELETE / UPDATE need execution confirmation in UI.
     * Does not include INSERT or DDL such as CREATE / ALTER.
     */
    public static boolean requiresDangerousSqlConfirmation(String sql) {
        if (sql == null || sql.isBlank()) {
            return false;
        }
        String stripped = stripSqlComments(sql).trim();
        if (stripped.isEmpty()) {
            return false;
        }
        String upper = stripped.toUpperCase(Locale.ROOT);
        if (upper.startsWith("INSERT ") || upper.startsWith("REPLACE ")) {
            return false;
        }
        return upper.startsWith("DELETE ")
                || upper.startsWith("UPDATE ")
                || upper.startsWith("TRUNCATE ")
                || upper.startsWith("DROP ");
    }

    private static String stripSqlComments(String sql) {
        return SqlTransformOps.stripComments(sql);
    }
}
