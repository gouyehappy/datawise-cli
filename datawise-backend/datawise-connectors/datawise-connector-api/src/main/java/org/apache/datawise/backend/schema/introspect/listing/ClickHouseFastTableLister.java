package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.jdbc.support.DbTypeFamilies;

import java.sql.SQLException;

final class ClickHouseFastTableLister implements FastTableLister {

    private final JdbcTableListingSupport support;

    ClickHouseFastTableLister(JdbcTableListingSupport support) {
        this.support = support;
    }

    @Override
    public boolean supports(String dbType) {
        return DbTypeFamilies.isClickhouse(dbType);
    }

    @Override
    public PaginatedTreeNodes listTablesPage(JdbcTableListingRequest request) throws SQLException {
        String database = JdbcTableListingSupport.resolveMysqlSchemaName(
                request.catalog(),
                request.schema(),
                request.scope()
        );
        String pattern = JdbcTableListingSupport.toSqlLikePattern(request.namePattern());
        String sql = """
                SELECT name AS table_name, comment AS table_comment
                FROM system.tables
                WHERE database = ?
                  AND engine NOT IN ('View', 'MaterializedView')
                """ + (pattern != null ? " AND name LIKE ?" : "") + """
                 ORDER BY name
                 LIMIT ? OFFSET ?
                """;
        return support.queryPagedTables(request, sql, (ps, probeLimit, offset) -> {
            int param = 1;
            ps.setString(param++, database);
            if (pattern != null) {
                ps.setString(param++, pattern);
            }
            ps.setInt(param++, probeLimit);
            ps.setInt(param, offset);
        });
    }
}
