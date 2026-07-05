package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.domain.PaginatedTreeNodes;

import java.sql.Connection;
import java.sql.SQLException;

/** H2 / HSQL table listing via information_schema. */
final class EmbeddedEngineFastTableLister implements FastTableLister {

    private final JdbcTableListingSupport support;

    EmbeddedEngineFastTableLister(JdbcTableListingSupport support) {
        this.support = support;
    }

    @Override
    public boolean supports(String dbType) {
        return DbType.H2.matches(dbType) || DbType.HSQL.matches(dbType);
    }

    @Override
    public PaginatedTreeNodes listTablesPage(JdbcTableListingRequest request) throws SQLException {
        String schemaName = resolveSchema(request.connection());
        String pattern = JdbcTableListingSupport.toSqlLikePattern(request.namePattern());
        String sql = """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = ? AND table_type IN ('TABLE', 'BASE TABLE')
                """ + (pattern != null ? " AND table_name LIKE ?" : "") + """
                 ORDER BY table_name
                 LIMIT ? OFFSET ?
                """;
        return support.queryPagedTables(request, sql, (ps, probeLimit, offset) -> {
            int param = 1;
            ps.setString(param++, schemaName);
            if (pattern != null) {
                ps.setString(param++, pattern);
            }
            ps.setInt(param++, probeLimit);
            ps.setInt(param, offset);
        });
    }

    private static String resolveSchema(Connection connection) throws SQLException {
        String current = connection.getSchema();
        if (current != null && !current.isBlank()) {
            return current.trim();
        }
        return "PUBLIC";
    }
}
