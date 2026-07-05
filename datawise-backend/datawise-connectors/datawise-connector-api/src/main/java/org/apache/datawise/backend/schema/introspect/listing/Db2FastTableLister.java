package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.jdbc.support.DbTypeFamilies;

import java.sql.SQLException;
import java.util.Locale;

final class Db2FastTableLister implements FastTableLister {

    private final JdbcTableListingSupport support;

    Db2FastTableLister(JdbcTableListingSupport support) {
        this.support = support;
    }

    @Override
    public boolean supports(String dbType) {
        return DbTypeFamilies.isDb2Family(dbType);
    }

    @Override
    public PaginatedTreeNodes listTablesPage(JdbcTableListingRequest request) throws SQLException {
        String schemaName = JdbcTableListingSupport.resolveDb2SchemaName(
                request.catalog(),
                request.schema(),
                request.scope(),
                request.connection()
        );
        String pattern = JdbcTableListingSupport.toSqlLikePattern(request.namePattern());
        String sql = """
                SELECT TABNAME AS table_name
                FROM SYSCAT.TABLES
                WHERE TABSCHEMA = ? AND TYPE = 'T'
                """ + (pattern != null ? " AND TABNAME LIKE ?" : "") + """
                 ORDER BY TABNAME
                 OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                """;
        return support.queryPagedTables(request, sql, (ps, probeLimit, offset) -> {
            int param = 1;
            ps.setString(param++, schemaName);
            if (pattern != null) {
                ps.setString(param++, pattern.toUpperCase(Locale.ROOT));
            }
            ps.setInt(param++, offset);
            ps.setInt(param, probeLimit);
        });
    }
}
