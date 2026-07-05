package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.jdbc.support.DbTypeFamilies;

import java.sql.SQLException;

final class SqlServerFastTableLister implements FastTableLister {

    private final JdbcTableListingSupport support;

    SqlServerFastTableLister(JdbcTableListingSupport support) {
        this.support = support;
    }

    @Override
    public boolean supports(String dbType) {
        return DbTypeFamilies.isSqlServerFamily(dbType);
    }

    @Override
    public PaginatedTreeNodes listTablesPage(JdbcTableListingRequest request) throws SQLException {
        String schemaName = JdbcTableListingSupport.resolveSqlServerSchemaName(
                request.schema(),
                request.scope()
        );
        String pattern = JdbcTableListingSupport.toSqlLikePattern(request.namePattern());
        String sql = """
                SELECT t.name AS table_name
                FROM sys.tables t
                INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
                WHERE s.name = ?
                """ + (pattern != null ? " AND t.name LIKE ?" : "") + """
                 ORDER BY t.name
                 OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                """;
        return support.queryPagedTables(request, sql, (ps, probeLimit, offset) -> {
            int param = 1;
            ps.setString(param++, schemaName);
            if (pattern != null) {
                ps.setString(param++, pattern);
            }
            ps.setInt(param++, offset);
            ps.setInt(param, probeLimit);
        });
    }
}
