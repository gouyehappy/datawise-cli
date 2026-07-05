package org.apache.datawise.backend.schema.introspect;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.schema.JdbcSchemaExplorerRegistry;
import org.apache.datawise.backend.schema.SchemaDialect;
import org.apache.datawise.backend.schema.SchemaDialectRegistry;
import org.apache.datawise.backend.schema.introspect.listing.JdbcDialectTableLister;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/** Lists JDBC tables for a catalog/schema scope. */
public final class JdbcTableLister {

    private final SchemaDialectRegistry dialectRegistry;
    private final SchemaTreeBuilder treeBuilder;
    private final JdbcDialectTableLister dialectTableLister;

    public JdbcTableLister(
            SchemaDialectRegistry dialectRegistry,
            SchemaTreeBuilder treeBuilder,
            JdbcSchemaExplorerRegistry explorerRegistry
    ) {
        this.dialectRegistry = dialectRegistry;
        this.treeBuilder = treeBuilder;
        this.dialectTableLister = new JdbcDialectTableLister(dialectRegistry, treeBuilder, explorerRegistry);
    }

    public List<TreeNode> listTables(Connection connection, String connectionId, String catalog, String dbType)
            throws SQLException {
        return listTables(connection, connectionId, catalog, null, dbType, false);
    }

    public List<TreeNode> listTables(
            Connection connection,
            String connectionId,
            String catalog,
            String schema,
            String dbType
    ) throws SQLException {
        return listTables(connection, connectionId, catalog, schema, dbType, false);
    }

    public List<TreeNode> listTables(
            Connection connection,
            String connectionId,
            String catalog,
            String schema,
            String dbType,
            boolean skeleton
    ) throws SQLException {
        PaginatedTreeNodes page = listTablesPage(
                connection,
                connectionId,
                catalog,
                schema,
                dbType,
                0,
                Integer.MAX_VALUE,
                skeleton,
                null
        );
        return page.nodes();
    }

    public PaginatedTreeNodes listTablesPage(
            Connection connection,
            String connectionId,
            String catalog,
            String schema,
            String dbType,
            int offset,
            int limit,
            boolean skeleton,
            String namePattern
    ) throws SQLException {
        if (dialectTableLister.supportsFastListing(dbType)) {
            try {
                PaginatedTreeNodes page = dialectTableLister.listTablesPage(
                        connection,
                        connectionId,
                        catalog,
                        schema,
                        dbType,
                        offset,
                        limit,
                        skeleton,
                        namePattern
                );
                if (page != null) {
                    return page;
                }
            } catch (Exception ex) {
                // Fall back to JDBC metadata when dialect SQL is unavailable (e.g. mocked tests).
            }
        }
        List<TreeNode> all = dialectTableLister.listTablesViaMetadata(
                connection,
                connectionId,
                catalog,
                schema,
                dbType,
                skeleton
        );
        if (namePattern != null && !namePattern.isBlank() && !"*".equals(namePattern.trim())) {
            String normalizedPattern = namePattern.trim().toLowerCase().replace("*", ".*");
            all = all.stream()
                    .filter(node -> node.getLabel() != null
                            && node.getLabel().toLowerCase().matches(normalizedPattern))
                    .toList();
        }
        return PaginatedTreeNodes.slice(all, offset, limit);
    }
}
