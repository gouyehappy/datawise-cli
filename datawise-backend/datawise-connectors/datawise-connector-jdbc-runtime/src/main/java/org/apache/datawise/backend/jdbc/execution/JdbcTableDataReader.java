package org.apache.datawise.backend.jdbc.execution;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.config.JdbcPoolProperties;
import org.apache.datawise.backend.domain.TableDataResult;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.sqlparser.SqlTransformOps;
import org.apache.datawise.backend.jdbc.connection.JdbcConnectionAccessor;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.sql.spi.SqlPaginationService;
import org.apache.datawise.backend.jdbc.support.MigrationWhereSupport;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Table-oriented read helpers: SELECT builders, paging, row count and ad-hoc SQL fetch.
 */
@Component
public class JdbcTableDataReader {

    private static final Pattern FROM_PATTERN = Pattern.compile("\\bfrom\\s+[`\"'\\[]?(\\w+)", Pattern.CASE_INSENSITIVE);

    private final JdbcConnectionAccessor connectionAccessor;
    private final JdbcPoolProperties poolProperties;
    private final SqlPaginationService paginationService;

    public JdbcTableDataReader(
            JdbcConnectionAccessor connectionAccessor,
            JdbcPoolProperties poolProperties,
            @Autowired(required = false) SqlPaginationService paginationService
    ) {
        this.connectionAccessor = connectionAccessor;
        this.poolProperties = poolProperties != null ? poolProperties : new JdbcPoolProperties();
        this.paginationService = paginationService != null ? paginationService : FallbackSqlPaginationService.INSTANCE;
    }

    /** Builds dialect-aware {@code SELECT *} for table browsing and migration source reads. */
    public String buildTableSelectSql(ConnectionEntity entity, String tableName, String database) {
        String dbType = DbType.normalizeId(entity.getDbType());
        return SqlTransformOps.buildSelectAll(dbType, database, tableName);
    }

    /** Fetches table rows with optional limit/offset pagination. */
    public TableDataResult fetchTable(
            ConnectionEntity entity,
            String tableName,
            String database,
            int maxRows,
            int offset
    ) throws SQLException {
        String dbType = DbType.normalizeId(entity.getDbType());
        String sql = buildTableSelectSql(entity, tableName, database);
        if (maxRows > 0) {
            sql = paginationService.applyLimitOffset(sql, dbType, maxRows + 1, Math.max(0, offset));
        }
        final String query = sql;
        if (maxRows > 0) {
            return connectionAccessor.withConnection(
                    entity,
                    database,
                    connection -> queryLimited(connection, query, maxRows, poolProperties)
            );
        }
        return connectionAccessor.withConnection(
                entity,
                database,
                connection -> queryAll(connection, query, poolProperties)
        );
    }

    public TableDataResult fetchTable(ConnectionEntity entity, String tableName, String database, int maxRows)
            throws SQLException {
        return fetchTable(entity, tableName, database, maxRows, 0);
    }

    /** Runs arbitrary SELECT and maps all rows (used by export/metadata helpers). */
    public TableDataResult fetchBySql(ConnectionEntity entity, String sql) throws SQLException {
        return connectionAccessor.withConnection(
                entity,
                null,
                connection -> queryAll(connection, sql, poolProperties)
        );
    }

    /** Counts rows for migration validation; optional WHERE is appended safely. */
    public long countTableRows(
            ConnectionEntity entity,
            String tableName,
            String database,
            String whereClause
    ) throws SQLException {
        String selectSql = buildTableSelectSql(entity, tableName, database);
        String countSql = SqlTransformOps.wrapCount(selectSql);
        countSql = MigrationWhereSupport.appendWhere(countSql, whereClause);
        final String query = countSql;
        return connectionAccessor.withConnection(entity, database, connection -> {
            try (Statement statement = connection.createStatement();
                 ResultSet rs = statement.executeQuery(query)) {
                if (rs.next()) {
                    return rs.getLong(1);
                }
                return 0L;
            }
        });
    }

    /** Fetches one page using dialect LIMIT/OFFSET wrapper. */
    public ExecuteSqlResult executeSelectPage(
            ConnectionEntity entity,
            String sql,
            String database,
            int pageSize,
            int offset
    ) throws SQLException {
        long startedAt = System.currentTimeMillis();
        ExecuteSqlResult result = connectionAccessor.withConnection(
                entity,
                database,
                connection -> executeSelectPageOnConnection(connection, entity.getDbType(), sql, pageSize, offset)
        );
        return JdbcStatementExecutor.withWallClockDuration(result, System.currentTimeMillis() - startedAt);
    }

    /** Page fetch on caller-owned connection (manual transaction sessions). */
    public ExecuteSqlResult executeSelectPageOnConnection(
            Connection connection,
            String dbType,
            String sql,
            int pageSize,
            int offset
    ) throws SQLException {
        long start = System.currentTimeMillis();
        String trimmed = sql != null ? sql.trim() : "";
        String pagedSql = paginationService.applyLimitOffset(trimmed, dbType, pageSize + 1, offset);
        try (Statement statement = connection.createStatement()) {
            poolProperties.applyPagedReadFetchSize(statement, pageSize);
            try (ResultSet rs = statement.executeQuery(pagedSql)) {
            TableDataResult tableData = JdbcResultSetMapper.mapPage(rs, pageSize);
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
                    tableData.hasMore(),
                    offset,
                    pageSize
            );
            }
        }
    }

    /** Best-effort table name extraction from SQL text for logging/UI hints. */
    public String guessTableName(String sql) {
        Matcher matcher = FROM_PATTERN.matcher(sql != null ? sql : "");
        return matcher.find() ? matcher.group(1) : null;
    }

    private static TableDataResult queryAll(
            Connection connection,
            String sql,
            JdbcPoolProperties poolProperties
    ) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            poolProperties.applyFetchSize(statement);
            try (ResultSet rs = statement.executeQuery(sql)) {
                return JdbcResultSetMapper.mapAll(rs);
            }
        }
    }

    private static TableDataResult queryLimited(
            Connection connection,
            String sql,
            int maxRows,
            JdbcPoolProperties poolProperties
    ) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            poolProperties.applyPagedReadFetchSize(statement, maxRows);
            try (ResultSet rs = statement.executeQuery(sql)) {
                return JdbcResultSetMapper.mapPage(rs, maxRows);
            }
        }
    }
}
