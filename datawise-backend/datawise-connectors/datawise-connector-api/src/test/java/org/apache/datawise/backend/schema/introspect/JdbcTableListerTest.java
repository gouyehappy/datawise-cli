package org.apache.datawise.backend.schema.introspect;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.common.DbTypeFamily;
import org.apache.datawise.backend.connector.ConnectorPluginContributionHolder;
import org.apache.datawise.backend.schema.JdbcSchemaExplorerRegistry;
import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.schema.GenericSchemaDialect;
import org.apache.datawise.backend.schema.SchemaDialect;
import org.apache.datawise.backend.schema.SchemaDialectRegistry;
import org.apache.datawise.backend.schema.SchemaScope;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JdbcTableListerTest {

    @Test
    void listTables_skipsRowsOutsideRequestedSchema() throws SQLException {
        Connection connection = mock(Connection.class);
        DatabaseMetaData meta = mock(DatabaseMetaData.class);
        ResultSet rs = mock(ResultSet.class);
        when(connection.getMetaData()).thenReturn(meta);
        when(connection.getCatalog()).thenReturn("app");
        when(meta.getTables("app", "public", "%", new String[]{"TABLE"})).thenReturn(rs);
        when(rs.next()).thenReturn(true, true, false);
        when(rs.getString("TABLE_NAME")).thenReturn("embeddings", "embeddings");
        when(rs.getString("TABLE_CAT")).thenReturn("app", "app");
        when(rs.getString("TABLE_SCHEM")).thenReturn("information_schema", "public");

        JdbcTableLister lister = lister(dialectRegistry());

        List<TreeNode> tables = lister.listTables(connection, "conn-1", "public", "postgresql");

        assertEquals(1, tables.size());
        assertEquals("embeddings", tables.get(0).getLabel());
    }

    @Test
    void listTables_returnsEmptyForSystemSchema() throws SQLException {
        Connection connection = mock(Connection.class);
        JdbcTableLister lister = lister(dialectRegistry());

        List<TreeNode> tables = lister.listTables(connection, "conn-1", "information_schema", "postgresql");

        assertTrue(tables.isEmpty());
    }

    @Test
    void matchesTableScope_requiresExactSchemaWhenConfigured() {
        SchemaScope scope = new SchemaScope("app", "public", "public");
        assertFalse(ExplorerSchemaFilter.matchesTableScope(scope, "app", "information_schema"));
        assertTrue(ExplorerSchemaFilter.matchesTableScope(scope, "app", "public"));
    }

    @Test
    void filterDatabaseRoots_removesPostgresqlSystemSchemas() {
        List<TreeNode> roots = List.of(
                treeNode("information_schema"),
                treeNode("public"),
                treeNode("workspaces")
        );

        List<TreeNode> filtered = ExplorerSchemaFilter.filterDatabaseRoots(roots, "postgresql", dialectRegistry());

        assertEquals(2, filtered.size());
        assertEquals("public", filtered.get(0).getLabel());
        assertEquals("workspaces", filtered.get(1).getLabel());
    }

    @Test
    void filterConnectionRoots_removesTrinoConnectionScriptsFolder() {
        List<TreeNode> roots = List.of(
                folderNode("scripts"),
                treeNode("hive")
        );

        List<TreeNode> filtered = ExplorerSchemaFilter.filterConnectionRoots(roots, "trino", dialectRegistry());

        assertEquals(1, filtered.size());
        assertEquals("hive", filtered.get(0).getLabel());
    }

    @Test
    void listTablesPage_usesSysTablesForSqlServer() throws SQLException {
        Connection connection = mock(Connection.class);
        PreparedStatement ps = mock(PreparedStatement.class);
        ResultSet rs = mock(ResultSet.class);
        when(connection.prepareStatement(contains("sys.tables"))).thenReturn(ps);
        when(ps.executeQuery()).thenReturn(rs);
        when(rs.next()).thenReturn(true, false);
        when(rs.getString("table_name")).thenReturn("orders");

        JdbcTableLister lister = lister(sqlServerDialectRegistry());
        PaginatedTreeNodes page = lister.listTablesPage(
                connection,
                "conn-1",
                "appdb",
                null,
                "sqlserver",
                0,
                10,
                true,
                null
        );

        assertEquals(1, page.nodes().size());
        assertEquals("orders", page.nodes().get(0).getLabel());
        verify(connection).prepareStatement(contains("sys.tables"));
    }

    @Test
    void listTablesPage_usesAllTablesForOracle() throws SQLException {
        Connection connection = mock(Connection.class);
        PreparedStatement ps = mock(PreparedStatement.class);
        ResultSet rs = mock(ResultSet.class);
        when(connection.prepareStatement(contains("all_tables"))).thenReturn(ps);
        when(ps.executeQuery()).thenReturn(rs);
        when(rs.next()).thenReturn(true, false);
        when(rs.getString("table_name")).thenReturn("EMPLOYEES");

        JdbcTableLister lister = lister(oracleDialectRegistry());
        PaginatedTreeNodes page = lister.listTablesPage(
                connection,
                "conn-1",
                "HR",
                null,
                "oracle",
                0,
                10,
                true,
                null
        );

        assertEquals(1, page.nodes().size());
        assertEquals("EMPLOYEES", page.nodes().get(0).getLabel());
        verify(connection).prepareStatement(contains("all_tables"));
    }

    @Test
    void listTablesPage_usesInformationSchemaForTrino() throws SQLException {
        Connection connection = mock(Connection.class);
        PreparedStatement ps = mock(PreparedStatement.class);
        ResultSet rs = mock(ResultSet.class);
        when(connection.prepareStatement(contains("information_schema.tables"))).thenReturn(ps);
        when(ps.executeQuery()).thenReturn(rs);
        when(rs.next()).thenReturn(true, false);
        when(rs.getString("table_name")).thenReturn("orders");

        JdbcTableLister lister = lister(trinoDialectRegistry());
        PaginatedTreeNodes page = lister.listTablesPage(
                connection,
                "conn-1",
                "hive",
                "default",
                "trino",
                0,
                10,
                true,
                null
        );

        assertEquals(1, page.nodes().size());
        assertEquals("orders", page.nodes().get(0).getLabel());
        verify(connection).prepareStatement(contains("information_schema.tables"));
    }

    @Test
    void listTablesPage_usesSysCatForDb2() throws SQLException {
        Connection connection = mock(Connection.class);
        PreparedStatement ps = mock(PreparedStatement.class);
        ResultSet rs = mock(ResultSet.class);
        when(connection.prepareStatement(contains("SYSCAT.TABLES"))).thenReturn(ps);
        when(ps.executeQuery()).thenReturn(rs);
        when(rs.next()).thenReturn(true, false);
        when(rs.getString("table_name")).thenReturn("ORDERS");

        JdbcTableLister lister = lister(db2DialectRegistry());
        PaginatedTreeNodes page = lister.listTablesPage(
                connection,
                "conn-1",
                "SAMPLE",
                null,
                "db2",
                0,
                10,
                true,
                null
        );

        assertEquals(1, page.nodes().size());
        assertEquals("ORDERS", page.nodes().get(0).getLabel());
        verify(connection).prepareStatement(contains("SYSCAT.TABLES"));
    }

    @Test
    void listTablesPage_usesSqliteMasterForSqlite() throws SQLException {
        Connection connection = mock(Connection.class);
        PreparedStatement ps = mock(PreparedStatement.class);
        ResultSet rs = mock(ResultSet.class);
        when(connection.prepareStatement(contains("sqlite_master"))).thenReturn(ps);
        when(ps.executeQuery()).thenReturn(rs);
        when(rs.next()).thenReturn(true, false);
        when(rs.getString("table_name")).thenReturn("users");

        JdbcTableLister lister = lister(genericDialectRegistry());
        PaginatedTreeNodes page = lister.listTablesPage(
                connection,
                "conn-1",
                "main",
                null,
                "sqlite",
                0,
                10,
                true,
                null
        );

        assertEquals(1, page.nodes().size());
        assertEquals("users", page.nodes().get(0).getLabel());
        verify(connection).prepareStatement(contains("sqlite_master"));
    }

    @Test
    void listTablesPage_usesInformationSchemaForH2() throws SQLException {
        Connection connection = mock(Connection.class);
        PreparedStatement ps = mock(PreparedStatement.class);
        ResultSet rs = mock(ResultSet.class);
        when(connection.getSchema()).thenReturn("PUBLIC");
        when(connection.prepareStatement(contains("information_schema.tables"))).thenReturn(ps);
        when(ps.executeQuery()).thenReturn(rs);
        when(rs.next()).thenReturn(true, false);
        when(rs.getString("table_name")).thenReturn("USERS");

        JdbcTableLister lister = lister(genericDialectRegistry());
        PaginatedTreeNodes page = lister.listTablesPage(
                connection,
                "conn-1",
                "test",
                null,
                "h2",
                0,
                10,
                true,
                null
        );

        assertEquals(1, page.nodes().size());
        assertEquals("USERS", page.nodes().get(0).getLabel());
        verify(connection).prepareStatement(contains("information_schema.tables"));
    }

    @Test
    void listTablesPage_usesAllTablesForDm() throws SQLException {
        Connection connection = mock(Connection.class);
        PreparedStatement ps = mock(PreparedStatement.class);
        ResultSet rs = mock(ResultSet.class);
        when(connection.prepareStatement(contains("all_tables"))).thenReturn(ps);
        when(ps.executeQuery()).thenReturn(rs);
        when(rs.next()).thenReturn(true, false);
        when(rs.getString("table_name")).thenReturn("EMPLOYEES");

        JdbcTableLister lister = lister(dmDialectRegistry());
        PaginatedTreeNodes page = lister.listTablesPage(
                connection,
                "conn-1",
                "SYSDBA",
                null,
                "dm",
                0,
                10,
                true,
                null
        );

        assertEquals(1, page.nodes().size());
        assertEquals("EMPLOYEES", page.nodes().get(0).getLabel());
        verify(connection).prepareStatement(contains("all_tables"));
    }

    private static TreeNode folderNode(String label) {
        TreeNode node = new TreeNode();
        node.setType("folder");
        node.setLabel(label);
        return node;
    }

    private static SchemaDialectRegistry dialectRegistry() {
        return new SchemaDialectRegistry(
                List.of(new FakePostgresqlDialect()),
                new GenericSchemaDialect(),
                new ConnectorPluginContributionHolder()
        );
    }

    private static SchemaDialectRegistry genericDialectRegistry() {
        return new SchemaDialectRegistry(
                List.of(),
                new GenericSchemaDialect(),
                new ConnectorPluginContributionHolder()
        );
    }

    private static SchemaDialectRegistry sqlServerDialectRegistry() {
        return new SchemaDialectRegistry(
                List.of(new FakeSqlServerDialect()),
                new GenericSchemaDialect(),
                new ConnectorPluginContributionHolder()
        );
    }

    private static SchemaDialectRegistry oracleDialectRegistry() {
        return new SchemaDialectRegistry(
                List.of(new FakeOracleDialect()),
                new GenericSchemaDialect(),
                new ConnectorPluginContributionHolder()
        );
    }

    private static SchemaDialectRegistry trinoDialectRegistry() {
        return new SchemaDialectRegistry(
                List.of(new FakeTrinoDialect()),
                new GenericSchemaDialect(),
                new ConnectorPluginContributionHolder()
        );
    }

    private static SchemaDialectRegistry db2DialectRegistry() {
        return new SchemaDialectRegistry(
                List.of(new FakeDb2Dialect()),
                new GenericSchemaDialect(),
                new ConnectorPluginContributionHolder()
        );
    }

    private static SchemaDialectRegistry dmDialectRegistry() {
        return new SchemaDialectRegistry(
                List.of(new FakeDmDialect()),
                new GenericSchemaDialect(),
                new ConnectorPluginContributionHolder()
        );
    }

    private static TreeNode treeNode(String label) {
        TreeNode node = new TreeNode();
        node.setId(label);
        node.setLabel(label);
        node.setType("database");
        return node;
    }

    private static final class FakePostgresqlDialect implements SchemaDialect {
        private static final Set<String> SYSTEM_SCHEMAS = Set.of("information_schema", "pg_catalog");

        @Override
        public String id() {
            return DbType.POSTGRESQL.id();
        }

        @Override
        public boolean supports(String dbType) {
            return DbType.isPostgresqlFamily(dbType);
        }

        @Override
        public SchemaScope resolveScope(Connection connection, String catalogLabel) throws SQLException {
            return new SchemaScope(connection.getCatalog(), catalogLabel, catalogLabel);
        }

        @Override
        public boolean isSystemSchema(String schema) {
            if (schema == null) {
                return true;
            }
            String value = schema.toLowerCase(Locale.ROOT);
            return value.startsWith("pg_") || SYSTEM_SCHEMAS.contains(value);
        }
    }

    private static final class FakeSqlServerDialect implements SchemaDialect {
        @Override
        public String id() {
            return DbType.SQLSERVER.id();
        }

        @Override
        public boolean supports(String dbType) {
            return DbType.isSqlServerFamily(dbType);
        }

        @Override
        public SchemaScope resolveScope(Connection connection, String catalogLabel) {
            return new SchemaScope(catalogLabel, "dbo", catalogLabel);
        }
    }

    private static final class FakeOracleDialect implements SchemaDialect {
        @Override
        public String id() {
            return DbType.ORACLE.id();
        }

        @Override
        public boolean supports(String dbType) {
            return DbType.ORACLE.id().equalsIgnoreCase(dbType);
        }

        @Override
        public SchemaScope resolveScope(Connection connection, String catalogLabel) {
            return new SchemaScope(catalogLabel, catalogLabel, catalogLabel);
        }
    }

    private static final class FakeTrinoDialect implements SchemaDialect {
        @Override
        public String id() {
            return DbType.TRINO.id();
        }

        @Override
        public boolean supports(String dbType) {
            return DbTypeFamily.isTrinoFamily(dbType);
        }

        @Override
        public boolean usesCatalogSchemaHierarchy() {
            return true;
        }

        @Override
        public SchemaScope resolveScope(Connection connection, String catalogLabel) {
            return new SchemaScope(catalogLabel, catalogLabel, catalogLabel);
        }

        @Override
        public SchemaScope resolveScope(Connection connection, String catalog, String schema) {
            return new SchemaScope(catalog, schema, catalog + "." + schema);
        }

        @Override
        public boolean isSystemCatalog(String catalog) {
            return "system".equalsIgnoreCase(catalog);
        }

        @Override
        public boolean isSystemSchema(String schema) {
            return "information_schema".equalsIgnoreCase(schema);
        }
    }

    private static JdbcSchemaExplorerRegistry emptyExplorerRegistry() {
        return new JdbcSchemaExplorerRegistry(List.of(), new ConnectorPluginContributionHolder());
    }

    private static JdbcTableLister lister(SchemaDialectRegistry registry) {
        return new JdbcTableLister(registry, new SchemaTreeBuilder(), emptyExplorerRegistry());
    }

    private static final class FakeDb2Dialect implements SchemaDialect {
        @Override
        public String id() {
            return DbType.DB2.id();
        }

        @Override
        public boolean supports(String dbType) {
            return DbTypeFamily.isDb2Family(dbType);
        }

        @Override
        public SchemaScope resolveScope(Connection connection, String catalogLabel) {
            return new SchemaScope(catalogLabel, catalogLabel, catalogLabel);
        }
    }

    private static final class FakeDmDialect implements SchemaDialect {
        @Override
        public String id() {
            return DbType.DM.id();
        }

        @Override
        public boolean supports(String dbType) {
            return DbTypeFamily.isDmFamily(dbType);
        }

        @Override
        public SchemaScope resolveScope(Connection connection, String catalogLabel) {
            return new SchemaScope(catalogLabel, catalogLabel, catalogLabel);
        }
    }
}
