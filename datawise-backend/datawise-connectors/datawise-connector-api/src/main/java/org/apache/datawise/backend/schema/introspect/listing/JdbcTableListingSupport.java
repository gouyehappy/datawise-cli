package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.schema.SchemaNodeIds;
import org.apache.datawise.backend.schema.SchemaScope;
import org.apache.datawise.backend.schema.introspect.SchemaTreeBuilder;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

final class JdbcTableListingSupport {

    private final SchemaTreeBuilder treeBuilder;

    JdbcTableListingSupport(SchemaTreeBuilder treeBuilder) {
        this.treeBuilder = treeBuilder;
    }

    PaginatedTreeNodes queryPagedTables(
            JdbcTableListingRequest request,
            String sql,
            SqlParameterBinder binder
    ) throws SQLException {
        int pageSize = Math.max(1, request.limit());
        int probeLimit = pageSize + 1;
        List<TreeNode> tables = new ArrayList<>();
        try (PreparedStatement ps = request.connection().prepareStatement(sql)) {
            binder.bind(ps, probeLimit, Math.max(0, request.offset()));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    tables.add(toTableNode(
                            request,
                            rs.getString("table_name"),
                            columnOrNull(rs, "table_comment")
                    ));
                }
            }
        }
        return PaginatedTreeNodes.slice(tables, 0, pageSize);
    }

    TreeNode toTableNode(JdbcTableListingRequest request, String tableName, String comment) {
        TreeNode table = new TreeNode();
        table.setId(tableNodeId(
                request.connectionId(),
                request.catalog(),
                request.schema(),
                tableName
        ));
        table.setLabel(tableName);
        table.setType("table");
        if (comment != null && !comment.isBlank()) {
            table.setComment(comment);
        }
        table.setExpanded(false);
        if (!request.skeleton()) {
            if (request.schema() != null && !request.schema().isBlank()) {
                table.setChildren(treeBuilder.buildTableSkeleton(
                        request.connectionId(),
                        request.catalog(),
                        request.schema(),
                        tableName
                ));
            } else {
                table.setChildren(treeBuilder.buildTableSkeleton(
                        request.connectionId(),
                        request.catalog(),
                        tableName
                ));
            }
        } else {
            table.setChildren(List.of());
        }
        return table;
    }

    static String resolveMysqlSchemaName(String catalog, String schema, SchemaScope scope) {
        if (schema != null && !schema.isBlank()) {
            return schema.trim();
        }
        if (catalog != null && !catalog.isBlank()) {
            return catalog.trim();
        }
        if (scope.catalogPattern() != null && !"%".equals(scope.catalogPattern())) {
            return scope.catalogPattern();
        }
        return catalog;
    }

    static String resolvePgSchema(SchemaScope scope, Connection connection) throws SQLException {
        if (scope.schemaPattern() != null && !scope.schemaPattern().isBlank() && !"%".equals(scope.schemaPattern())) {
            return scope.schemaPattern();
        }
        String current = connection.getSchema();
        return current != null && !current.isBlank() ? current : "public";
    }

    static String resolveSqlServerSchemaName(String schema, SchemaScope scope) {
        if (schema != null && !schema.isBlank()) {
            return schema.trim();
        }
        if (scope.schemaPattern() != null && !scope.schemaPattern().isBlank() && !"%".equals(scope.schemaPattern())) {
            return scope.schemaPattern();
        }
        return "dbo";
    }

    static String resolveOracleOwner(
            String catalog,
            String schema,
            SchemaScope scope,
            Connection connection
    ) throws SQLException {
        if (schema != null && !schema.isBlank()) {
            return schema.trim().toUpperCase(Locale.ROOT);
        }
        if (catalog != null && !catalog.isBlank()) {
            return catalog.trim().toUpperCase(Locale.ROOT);
        }
        if (scope.schemaPattern() != null && !scope.schemaPattern().isBlank() && !"%".equals(scope.schemaPattern())) {
            return scope.schemaPattern().trim().toUpperCase(Locale.ROOT);
        }
        String current = connection.getSchema();
        if (current != null && !current.isBlank()) {
            return current.trim().toUpperCase(Locale.ROOT);
        }
        String user = connection.getMetaData().getUserName();
        return user != null ? user.trim().toUpperCase(Locale.ROOT) : "";
    }

    static String resolveDb2SchemaName(
            String catalog,
            String schema,
            SchemaScope scope,
            Connection connection
    ) throws SQLException {
        return resolveOracleOwner(catalog, schema, scope, connection);
    }

    static String toSqlLikePattern(String namePattern) {
        if (namePattern == null || namePattern.isBlank() || "*".equals(namePattern.trim())) {
            return null;
        }
        return namePattern.trim().replace("*", "%");
    }

    static String tableNodeId(String connectionId, String catalog, String schema, String tableName) {
        if (schema != null && !schema.isBlank()) {
            return SchemaNodeIds.nodeId("table", connectionId, catalog, schema, tableName);
        }
        return SchemaNodeIds.nodeId("table", connectionId, catalog, tableName);
    }

    private static String columnOrNull(ResultSet rs, String column) throws SQLException {
        try {
            return rs.getString(column);
        } catch (SQLException ignored) {
            return null;
        }
    }

    @FunctionalInterface
    interface SqlParameterBinder {
        void bind(PreparedStatement ps, int probeLimit, int offset) throws SQLException;
    }
}
