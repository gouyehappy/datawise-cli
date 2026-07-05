package org.apache.datawise.backend.schema.introspect;

import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.schema.SchemaDialect;
import org.apache.datawise.backend.schema.SchemaDialectRegistry;
import org.apache.datawise.backend.schema.SchemaNodeIds;
import org.apache.datawise.backend.schema.SchemaScope;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Lists JDBC views for a catalog/schema scope. */
final class JdbcViewLister {

    private static final String[] JDBC_VIEW_TYPES = {"VIEW", "VIRTUAL_VIEW", "MATERIALIZED_VIEW"};

    private final SchemaDialectRegistry dialectRegistry;

    JdbcViewLister(SchemaDialectRegistry dialectRegistry) {
        this.dialectRegistry = dialectRegistry;
    }

    List<TreeNode> listViews(
            Connection connection,
            String connectionId,
            String catalog,
            String schema,
            String dbType
    ) throws SQLException {
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
        DatabaseMetaData meta = connection.getMetaData();
        Set<String> seen = new LinkedHashSet<>();
        List<TreeNode> views = new ArrayList<>();
        for (String[] probe : metadataProbes(scope)) {
            appendMetadataViews(
                    meta,
                    probe[0],
                    probe[1],
                    scope,
                    connectionId,
                    catalog,
                    schema,
                    seen,
                    views
            );
            if (!views.isEmpty()) {
                return views;
            }
        }
        return views;
    }

    private static String[][] metadataProbes(SchemaScope scope) {
        String catalog = scope.catalogPattern();
        String schema = scope.schemaPattern();
        if (schema != null && !schema.isBlank() && !"%".equals(schema)) {
            return new String[][]{
                    {null, schema.trim()},
                    {catalog, schema.trim()},
            };
        }
        if (catalog != null && !catalog.isBlank() && !"%".equals(catalog)) {
            return new String[][]{
                    {null, catalog.trim()},
                    {catalog.trim(), "%"},
                    {catalog.trim(), null},
            };
        }
        return new String[][]{{null, "%"}};
    }

    private void appendMetadataViews(
            DatabaseMetaData meta,
            String catalogPattern,
            String schemaPattern,
            SchemaScope filterScope,
            String connectionId,
            String catalog,
            String schema,
            Set<String> seen,
            List<TreeNode> views
    ) throws SQLException {
        try (ResultSet rs = meta.getTables(catalogPattern, schemaPattern, "%", JDBC_VIEW_TYPES)) {
            while (rs.next()) {
                String viewName = resultString(rs, "TABLE_NAME", "table_name");
                if (viewName == null || viewName.isBlank() || !seen.add(viewName)) {
                    continue;
                }
                String tableCatalog = resultString(rs, "TABLE_CAT", "table_cat");
                String tableSchema = resultString(rs, "TABLE_SCHEM", "table_schem");
                if (!ExplorerSchemaFilter.matchesTableScope(filterScope, tableCatalog, tableSchema)) {
                    continue;
                }
                views.add(toViewNode(
                        connectionId,
                        catalog,
                        schema,
                        viewName,
                        resultString(rs, "REMARKS", "remarks")
                ));
            }
        }
    }

    private static TreeNode toViewNode(
            String connectionId,
            String catalog,
            String schema,
            String viewName,
            String comment
    ) {
        TreeNode view = new TreeNode();
        view.setId(viewNodeId(connectionId, catalog, schema, viewName));
        view.setLabel(viewName);
        view.setType("view");
        if (comment != null && !comment.isBlank()) {
            view.setComment(comment);
        }
        view.setExpanded(false);
        view.setChildren(List.of());
        return view;
    }

    private static String viewNodeId(String connectionId, String catalog, String schema, String viewName) {
        if (schema != null && !schema.isBlank()) {
            return SchemaNodeIds.nodeId("view", connectionId, catalog, schema, viewName);
        }
        return SchemaNodeIds.nodeId("view", connectionId, catalog, viewName);
    }

    private static String resultString(ResultSet rs, String... labels) throws SQLException {
        for (String label : labels) {
            try {
                String value = rs.getString(label);
                if (value != null) {
                    return value;
                }
            } catch (SQLException ignored) {
                // try next label
            }
        }
        return null;
    }
}
