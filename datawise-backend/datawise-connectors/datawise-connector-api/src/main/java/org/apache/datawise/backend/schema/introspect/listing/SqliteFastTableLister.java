package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.domain.PaginatedTreeNodes;

import java.sql.SQLException;

final class SqliteFastTableLister implements FastTableLister {

    private final JdbcTableListingSupport support;

    SqliteFastTableLister(JdbcTableListingSupport support) {
        this.support = support;
    }

    @Override
    public boolean supports(String dbType) {
        return DbType.SQLITE3.matches(dbType);
    }

    @Override
    public PaginatedTreeNodes listTablesPage(JdbcTableListingRequest request) throws SQLException {
        String pattern = JdbcTableListingSupport.toSqlLikePattern(request.namePattern());
        String sql = """
                SELECT name AS table_name
                FROM sqlite_master
                WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                """ + (pattern != null ? " AND name LIKE ?" : "") + """
                 ORDER BY name
                 LIMIT ? OFFSET ?
                """;
        return support.queryPagedTables(request, sql, (ps, probeLimit, offset) -> {
            int param = 1;
            if (pattern != null) {
                ps.setString(param++, pattern);
            }
            ps.setInt(param++, probeLimit);
            ps.setInt(param, offset);
        });
    }
}
