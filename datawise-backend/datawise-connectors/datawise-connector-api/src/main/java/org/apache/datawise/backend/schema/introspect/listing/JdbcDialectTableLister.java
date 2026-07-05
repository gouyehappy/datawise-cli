package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.schema.JdbcSchemaExplorerRegistry;
import org.apache.datawise.backend.schema.SchemaDialect;
import org.apache.datawise.backend.schema.SchemaDialectRegistry;
import org.apache.datawise.backend.schema.SchemaNodeIds;
import org.apache.datawise.backend.schema.SchemaScope;
import org.apache.datawise.backend.schema.introspect.ExplorerSchemaFilter;
import org.apache.datawise.backend.schema.introspect.SchemaTreeBuilder;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * Fast table listing via information_schema / sys.tables / all_tables for JDBC families,
 * with offset/limit pagination and optional name pattern.
 */
public final class JdbcDialectTableLister {

    private final SchemaDialectRegistry dialectRegistry;
    private final SchemaTreeBuilder treeBuilder;
    private final JdbcSchemaExplorerRegistry explorerRegistry;
    private final FastTableListingRegistry fastListingRegistry;

    public JdbcDialectTableLister(
            SchemaDialectRegistry dialectRegistry,
            SchemaTreeBuilder treeBuilder,
            JdbcSchemaExplorerRegistry explorerRegistry
    ) {
        this.dialectRegistry = dialectRegistry;
        this.treeBuilder = treeBuilder;
        this.explorerRegistry = explorerRegistry;
        this.fastListingRegistry = new FastTableListingRegistry(treeBuilder);
    }

    public boolean supportsFastListing(String dbType) {
        return fastListingRegistry.supportsFastListing(dbType);
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
        SchemaDialect dialect = dialectRegistry.resolve(dbType);
        if (!ExplorerSchemaFilter.isUserCatalog(dialect, dbType, catalog)) {
            return PaginatedTreeNodes.empty();
        }
        if (schema != null && !schema.isBlank() && dialect.isSystemSchema(schema)) {
            return PaginatedTreeNodes.empty();
        }
        SchemaScope scope = schema != null && !schema.isBlank()
                ? dialect.resolveScope(connection, catalog, schema)
                : dialect.resolveScope(connection, catalog);
        JdbcTableListingRequest request = new JdbcTableListingRequest(
                connection,
                connectionId,
                catalog,
                schema,
                scope,
                offset,
                limit,
                skeleton,
                namePattern
        );
        return fastListingRegistry.listTablesPage(request, dbType);
    }

    public List<TreeNode> listTablesViaMetadata(
            Connection connection,
            String connectionId,
            String catalog,
            String schema,
            String dbType,
            boolean skeleton
    ) throws SQLException {
        var explorer = explorerRegistry.find(dbType);
        if (explorer.isPresent()) {
            return explorer.get().listTables(connection, connectionId, catalog, schema, skeleton);
        }
        DatabaseMetaData meta = connection.getMetaData();
        SchemaDialect dialect = dialectRegistry.resolve(dbType);
        if (!ExplorerSchemaFilter.isUserCatalog(dialect, dbType, catalog)) {
            return List.of();
        }
        if (schema != null && !schema.isBlank() && dialect.isSystemSchema(schema)) {
            return List.of();
        }
        SchemaScope scope = schema != null && !schema.isBlank()
                ? dialect.resolveScope(connection, catalog, schema)
                : dialect.resolveScope(connection, catalog);
        List<TreeNode> tables = new ArrayList<>();
        try (ResultSet rs = meta.getTables(scope.catalogPattern(), scope.schemaPattern(), "%", new String[]{"TABLE"})) {
            while (rs.next()) {
                String tableName = rs.getString("TABLE_NAME");
                if (tableName == null || tableName.isBlank()) {
                    continue;
                }
                String tableCatalog = rs.getString("TABLE_CAT");
                String tableSchema = rs.getString("TABLE_SCHEM");
                if (!ExplorerSchemaFilter.matchesTableScope(scope, tableCatalog, tableSchema)) {
                    continue;
                }
                tables.add(metadataTableNode(
                        connectionId,
                        catalog,
                        schema,
                        tableName,
                        rs.getString("REMARKS"),
                        skeleton
                ));
            }
        }
        return tables;
    }

    private TreeNode metadataTableNode(
            String connectionId,
            String catalog,
            String schema,
            String tableName,
            String comment,
            boolean skeleton
    ) {
        TreeNode table = new TreeNode();
        if (schema != null && !schema.isBlank()) {
            table.setId(SchemaNodeIds.nodeId("table", connectionId, catalog, schema, tableName));
        } else {
            table.setId(SchemaNodeIds.nodeId("table", connectionId, catalog, tableName));
        }
        table.setLabel(tableName);
        table.setType("table");
        if (comment != null && !comment.isBlank()) {
            table.setComment(comment);
        }
        table.setExpanded(false);
        if (!skeleton) {
            if (schema != null && !schema.isBlank()) {
                table.setChildren(treeBuilder.buildTableSkeleton(connectionId, catalog, schema, tableName));
            } else {
                table.setChildren(treeBuilder.buildTableSkeleton(connectionId, catalog, tableName));
            }
        } else {
            table.setChildren(List.of());
        }
        return table;
    }
}
