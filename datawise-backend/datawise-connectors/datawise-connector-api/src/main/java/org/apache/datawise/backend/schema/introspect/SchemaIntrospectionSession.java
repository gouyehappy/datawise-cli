package org.apache.datawise.backend.schema.introspect;

import org.apache.datawise.backend.connector.catalog.SchemaSession;
import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.model.ConnectionEntity;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/** Schema introspection on a single JDBC connection (avoids reconnect per tree expand). */
public class SchemaIntrospectionSession implements SchemaSession {

    private final Connection connection;
    private final JdbcSchemaIntrospector introspector;
    private final ConnectionEntity entity;

    protected SchemaIntrospectionSession(Connection connection, JdbcSchemaIntrospector introspector, ConnectionEntity entity) {
        this.connection = connection;
        this.introspector = introspector;
        this.entity = entity;
    }

    @Override
    public List<TreeNode> introspectConnection() throws SQLException {
        return introspector.introspectConnection(connection, entity);
    }

    @Override
    public List<TreeNode> loadDatabaseChildren(String catalog) throws SQLException {
        return introspector.loadDatabaseChildren(connection, entity, catalog);
    }

    @Override
    public List<TreeNode> loadSchemaChildren(String catalog, String schema) throws SQLException {
        return introspector.loadSchemaChildren(connection, entity, catalog, schema);
    }

    @Override
    public List<TreeNode> loadTableList(String catalog) throws SQLException {
        return introspector.loadTableList(connection, entity, catalog);
    }

    @Override
    public List<TreeNode> loadTableList(String catalog, String schema) throws SQLException {
        return introspector.loadTableList(connection, entity, catalog, schema);
    }

    @Override
    public List<TreeNode> loadViewList(String catalog) throws SQLException {
        return introspector.loadViewList(connection, entity, catalog);
    }

    @Override
    public List<TreeNode> loadViewList(String catalog, String schema) throws SQLException {
        return introspector.loadViewList(connection, entity, catalog, schema);
    }

    @Override
    public PaginatedTreeNodes loadTableListPage(
            String catalog,
            String schema,
            int offset,
            int limit,
            boolean skeleton,
            String namePattern
    ) throws SQLException {
        return introspector.loadTableListPage(
                connection,
                entity,
                catalog,
                schema,
                offset,
                limit,
                skeleton,
                namePattern
        );
    }

    @Override
    public List<TreeNode> loadTableSkeletonChildren(String catalog, String tableName) {
        return introspector.loadTableSkeletonChildren(entity.getId(), catalog, tableName);
    }

    @Override
    public List<TreeNode> loadTableSkeletonChildren(String catalog, String schema, String tableName) {
        return introspector.loadTableSkeletonChildren(entity.getId(), catalog, schema, tableName);
    }

    @Override
    public List<TreeNode> loadViewSkeletonChildren(String catalog, String viewName) {
        return introspector.loadViewSkeletonChildren(entity.getId(), catalog, viewName);
    }

    @Override
    public List<TreeNode> loadViewSkeletonChildren(String catalog, String schema, String viewName) {
        return introspector.loadViewSkeletonChildren(entity.getId(), catalog, schema, viewName);
    }

    @Override
    public List<TreeNode> loadColumnChildren(String catalog, String tableName) throws SQLException {
        return introspector.loadColumnChildren(connection, entity, catalog, tableName);
    }

    @Override
    public List<TreeNode> loadColumnChildren(String catalog, String schema, String tableName) throws SQLException {
        return introspector.loadColumnChildren(connection, entity, catalog, schema, tableName);
    }

    @Override
    public List<TreeNode> loadKeyChildren(String catalog, String tableName) throws SQLException {
        return introspector.loadKeyChildren(connection, entity, catalog, tableName);
    }

    @Override
    public List<TreeNode> loadKeyChildren(String catalog, String schema, String tableName) throws SQLException {
        return introspector.loadKeyChildren(connection, entity, catalog, schema, tableName);
    }

    @Override
    public List<TreeNode> loadIndexChildren(String catalog, String tableName) throws SQLException {
        return introspector.loadIndexChildren(connection, entity, catalog, tableName);
    }

    @Override
    public List<TreeNode> loadIndexChildren(String catalog, String schema, String tableName) throws SQLException {
        return introspector.loadIndexChildren(connection, entity, catalog, schema, tableName);
    }

    @Override
    public String connectionId() {
        return entity.getId();
    }

    @Override
    public void close() throws SQLException {
        connection.close();
    }
}
