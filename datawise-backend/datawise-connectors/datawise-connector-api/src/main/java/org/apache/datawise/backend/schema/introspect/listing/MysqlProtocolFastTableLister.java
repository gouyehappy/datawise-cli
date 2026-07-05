package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.jdbc.support.DbTypeFamilies;

import java.sql.SQLException;

final class MysqlProtocolFastTableLister implements FastTableLister {

    private final JdbcTableListingSupport support;

    MysqlProtocolFastTableLister(JdbcTableListingSupport support) {
        this.support = support;
    }

    @Override
    public boolean supports(String dbType) {
        return DbTypeFamilies.isMysqlProtocol(dbType);
    }

    @Override
    public PaginatedTreeNodes listTablesPage(JdbcTableListingRequest request) throws SQLException {
        String schemaName = JdbcTableListingSupport.resolveMysqlSchemaName(
                request.catalog(),
                request.schema(),
                request.scope()
        );
        String pattern = JdbcTableListingSupport.toSqlLikePattern(request.namePattern());
        String sql = """
                SELECT TABLE_NAME AS table_name, TABLE_COMMENT AS table_comment
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
                """ + (pattern != null ? " AND TABLE_NAME LIKE ?" : "") + """
                 ORDER BY TABLE_NAME
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
