package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.jdbc.support.DbTypeFamilies;

import java.sql.SQLException;

final class PostgresqlFastTableLister implements FastTableLister {

    private final JdbcTableListingSupport support;

    PostgresqlFastTableLister(JdbcTableListingSupport support) {
        this.support = support;
    }

    @Override
    public boolean supports(String dbType) {
        return DbTypeFamilies.isPostgresqlFamily(dbType);
    }

    @Override
    public PaginatedTreeNodes listTablesPage(JdbcTableListingRequest request) throws SQLException {
        String schemaName = request.schema() != null && !request.schema().isBlank()
                ? request.schema().trim()
                : JdbcTableListingSupport.resolvePgSchema(request.scope(), request.connection());
        String pattern = JdbcTableListingSupport.toSqlLikePattern(request.namePattern());
        String sql = """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = ? AND table_type = 'BASE TABLE'
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
}
