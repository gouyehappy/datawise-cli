package org.apache.datawise.backend.connector.catalog;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.domain.TreeNode;

import java.sql.SQLException;
import java.util.List;

/** Explorer schema 树单次 JDBC 会话（实现位于 connector-api / jdbc-runtime）。 */
public interface SchemaSession extends AutoCloseable {

    @Override
    void close() throws SQLException;

    List<TreeNode> introspectConnection() throws SQLException;

    List<TreeNode> loadDatabaseChildren(String catalog) throws SQLException;

    default List<TreeNode> loadSchemaChildren(String catalog, String schema) throws SQLException {
        throw new SQLException("Schema children not supported for this datasource");
    }

    List<TreeNode> loadTableList(String catalog) throws SQLException;

    default List<TreeNode> loadTableList(String catalog, String schema) throws SQLException {
        return loadTableList(catalog);
    }

    default List<TreeNode> loadViewList(String catalog) throws SQLException {
        return loadViewList(catalog, null);
    }

    default List<TreeNode> loadViewList(String catalog, String schema) throws SQLException {
        return List.of();
    }

    default PaginatedTreeNodes loadTableListPage(
            String catalog,
            String schema,
            int offset,
            int limit,
            boolean skeleton,
            String namePattern
    ) throws SQLException {
        List<TreeNode> all = schema != null && !schema.isBlank()
                ? loadTableList(catalog, schema)
                : loadTableList(catalog);
        return PaginatedTreeNodes.slice(all, offset, limit);
    }

    List<TreeNode> loadTableSkeletonChildren(String catalog, String tableName);

    default List<TreeNode> loadTableSkeletonChildren(String catalog, String schema, String tableName) {
        return loadTableSkeletonChildren(catalog, tableName);
    }

    default List<TreeNode> loadViewSkeletonChildren(String catalog, String viewName) {
        return loadViewSkeletonChildren(catalog, null, viewName);
    }

    default List<TreeNode> loadViewSkeletonChildren(String catalog, String schema, String viewName) {
        return List.of();
    }

    List<TreeNode> loadColumnChildren(String catalog, String tableName) throws SQLException;

    default List<TreeNode> loadColumnChildren(String catalog, String schema, String tableName) throws SQLException {
        return loadColumnChildren(catalog, tableName);
    }

    List<TreeNode> loadKeyChildren(String catalog, String tableName) throws SQLException;

    default List<TreeNode> loadKeyChildren(String catalog, String schema, String tableName) throws SQLException {
        return loadKeyChildren(catalog, tableName);
    }

    List<TreeNode> loadIndexChildren(String catalog, String tableName) throws SQLException;

    default List<TreeNode> loadIndexChildren(String catalog, String schema, String tableName) throws SQLException {
        return loadIndexChildren(catalog, tableName);
    }

    String connectionId();

    /** JDBC 会话是否仍可安全复用；非 JDBC 实现默认可用。 */
    default boolean isConnectionUsable() {
        return true;
    }
}
