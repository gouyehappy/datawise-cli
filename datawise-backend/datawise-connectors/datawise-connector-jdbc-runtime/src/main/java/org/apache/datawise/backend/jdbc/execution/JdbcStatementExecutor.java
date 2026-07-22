package org.apache.datawise.backend.jdbc.execution;

import org.apache.datawise.backend.config.JdbcPoolProperties;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.backend.domain.TableDataResult;
import org.apache.datawise.backend.domain.TableRowMutateResult;
import org.apache.datawise.backend.jdbc.support.SqlExecutionTracker;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

/**
 * Executes SQL statements on an existing JDBC connection (no pool borrow/return).
 */
@Component
public class JdbcStatementExecutor {

    private final JdbcPoolProperties poolProperties;

    public JdbcStatementExecutor(JdbcPoolProperties poolProperties) {
        this.poolProperties = poolProperties != null ? poolProperties : new JdbcPoolProperties();
    }

    /** Runs one statement and maps SELECT result or update row count. */
    public ExecuteSqlResult executeOnConnection(Connection connection, String sql, int maxRows) throws SQLException {
        return executeOnConnection(connection, sql, maxRows, null, null);
    }

    /**
     * Same as {@link #executeOnConnection(Connection, String, int)} but registers statement for cancel API.
     */
    public ExecuteSqlResult executeOnConnection(
            Connection connection,
            String sql,
            int maxRows,
            String executionKey,
            SqlExecutionTracker tracker
    ) throws SQLException {
        long start = System.currentTimeMillis();
        String trimmed = sql != null ? sql.trim() : "";
        Statement statement = connection.createStatement();
        poolProperties.applyFetchSize(statement);
        if (executionKey != null && tracker != null) {
            tracker.register(executionKey, statement, connection);
        }
        try {
            if (maxRows > 0) {
                statement.setMaxRows(maxRows);
            }
            boolean hasResult = statement.execute(trimmed);
            if (!hasResult) {
                long duration = System.currentTimeMillis() - start;
                int affected = statement.getUpdateCount();
                int rowCount = affected >= 0 ? affected : 0;
                return new ExecuteSqlResult(trimmed, rowCount, duration, List.of(), List.of(), null, null, null, null, null, null);
            }
            try (ResultSet rs = statement.getResultSet()) {
                TableDataResult tableData = JdbcResultSetMapper.mapAll(rs);
                long duration = System.currentTimeMillis() - start;
                return new ExecuteSqlResult(
                        trimmed,
                        tableData.rows().size(),
                        duration,
                        tableData.columns(),
                        tableData.rows(),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null
                );
            }
        } finally {
            if (executionKey != null && tracker != null) {
                tracker.unregister(executionKey);
            }
            statement.close();
        }
    }

    /** Executes DML/DDL update and returns affected row count. */
    public TableRowMutateResult executeUpdate(Connection connection, String sql) throws SQLException {
        String trimmed = sql != null ? sql.trim() : "";
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("SQL is required");
        }
        try (Statement statement = connection.createStatement()) {
            int affected = statement.executeUpdate(trimmed);
            return new TableRowMutateResult(affected, trimmed);
        }
    }

    /** Replaces execution duration with wall-clock time including connection borrow. */
    public static ExecuteSqlResult withWallClockDuration(ExecuteSqlResult result, long durationMs) {
        return new ExecuteSqlResult(
                result.sql(),
                result.rowCount(),
                durationMs,
                result.columns(),
                result.rows(),
                result.where(),
                result.orderBy(),
                result.cursorId(),
                result.hasMore(),
                result.pageOffset(),
                result.pageSize()
        );
    }
}
