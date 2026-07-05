package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.jdbc.support.DbTypeFamilies;

import java.sql.SQLException;

final class CatalogSchemaFastTableLister implements FastTableLister {

    private final JdbcTableListingSupport support;

    CatalogSchemaFastTableLister(JdbcTableListingSupport support) {
        this.support = support;
    }

    @Override
    public boolean supports(String dbType) {
        return DbTypeFamilies.isTrinoFamily(dbType);
    }

    @Override
    public PaginatedTreeNodes listTablesPage(JdbcTableListingRequest request) throws SQLException {
        if (request.schema() == null || request.schema().isBlank()
                || request.catalog() == null || request.catalog().isBlank()) {
            return null;
        }
        String pattern = JdbcTableListingSupport.toSqlLikePattern(request.namePattern());
        String sql = """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_catalog = ? AND table_schema = ? AND table_type = 'BASE TABLE'
                """ + (pattern != null ? " AND table_name LIKE ?" : "") + """
                 ORDER BY table_name
                 OFFSET ? LIMIT ?
                """;
        return support.queryPagedTables(request, sql, (ps, probeLimit, offset) -> {
            int param = 1;
            ps.setString(param++, request.catalog().trim());
            ps.setString(param++, request.schema().trim());
            if (pattern != null) {
                ps.setString(param++, pattern);
            }
            ps.setInt(param++, offset);
            ps.setInt(param, probeLimit);
        });
    }
}
