package org.apache.datawise.backend.schema.spi;

import org.apache.datawise.backend.domain.TableColumnDetail;
import org.apache.datawise.backend.domain.TreeNode;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/**
 * Optional JDBC Explorer overrides for connectors whose catalog/table/column metadata
 * does not fit the generic {@code DatabaseMetaData} paths (e.g. Apache Hive).
 */
public interface JdbcSchemaExplorer {

    boolean supports(String dbType);

    /** Lower value wins when multiple explorers match. */
    default int priority() {
        return 100;
    }

    List<TreeNode> introspectConnection(Connection connection, String connectionId) throws SQLException;

    List<TreeNode> loadDatabaseChildren(Connection connection, String connectionId, String catalog) throws SQLException;

    List<TreeNode> listTables(
            Connection connection,
            String connectionId,
            String catalog,
            String schema,
            boolean skeleton
    ) throws SQLException;

    List<TableColumnDetail> loadColumns(Connection connection, String database, String tableName) throws SQLException;

    String quoteQualifiedTable(String database, String tableName);
}
