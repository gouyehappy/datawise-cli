package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.jdbc.support.DbTypeFamilies;

import java.sql.SQLException;
import java.util.Locale;

final class OracleFastTableLister implements FastTableLister {

    private final JdbcTableListingSupport support;

    OracleFastTableLister(JdbcTableListingSupport support) {
        this.support = support;
    }

    @Override
    public boolean supports(String dbType) {
        return DbTypeFamilies.isOracleFamily(dbType) || DbTypeFamilies.isDmFamily(dbType);
    }

    @Override
    public PaginatedTreeNodes listTablesPage(JdbcTableListingRequest request) throws SQLException {
        String owner = JdbcTableListingSupport.resolveOracleOwner(
                request.catalog(),
                request.schema(),
                request.scope(),
                request.connection()
        );
        String pattern = JdbcTableListingSupport.toSqlLikePattern(request.namePattern());
        String sql = """
                SELECT table_name
                FROM all_tables
                WHERE owner = ?
                """ + (pattern != null ? " AND table_name LIKE ?" : "") + """
                 ORDER BY table_name
                 OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                """;
        return support.queryPagedTables(request, sql, (ps, probeLimit, offset) -> {
            int param = 1;
            ps.setString(param++, owner);
            if (pattern != null) {
                ps.setString(param++, pattern.toUpperCase(Locale.ROOT));
            }
            ps.setInt(param++, offset);
            ps.setInt(param, probeLimit);
        });
    }
}
