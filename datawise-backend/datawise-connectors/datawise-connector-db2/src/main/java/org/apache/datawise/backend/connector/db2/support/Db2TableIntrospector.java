package org.apache.datawise.backend.connector.db2.support;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.connector.api.support.TableMetadataSupport;
import org.apache.datawise.backend.domain.TableColumnDetail;
import org.apache.datawise.backend.domain.TableDdlResult;
import org.apache.datawise.backend.domain.TableForeignKeyDetail;
import org.apache.datawise.backend.domain.TableIndexDetail;
import org.apache.datawise.backend.domain.TablePropertiesResult;
import org.apache.datawise.backend.metadata.spi.TableMetadataIntrospection;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.schema.SchemaScope;
import org.apache.datawise.backend.schema.TableMetadataLoader;

import java.sql.Clob;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** DB2 table/view metadata via data dictionary views (Oracle-compatible). */
public class Db2TableIntrospector implements TableMetadataIntrospection {

    @Override
    public boolean supports(String dbType) {
        return DbType.isDb2Family(dbType);
    }

    @Override
    public int priority() {
        return 20;
    }

    @Override
    public TablePropertiesResult loadProperties(
            Connection connection,
            ConnectionEntity entity,
            String database,
            String tableName
    ) throws SQLException {
        return loadRelationProperties(connection, entity, database, tableName, false);
    }

    @Override
    public TablePropertiesResult loadViewProperties(
            Connection connection,
            ConnectionEntity entity,
            String database,
            String viewName
    ) throws SQLException {
        return loadRelationProperties(connection, entity, database, viewName, true);
    }

    @Override
    public TableDdlResult loadDdl(
            Connection connection,
            ConnectionEntity entity,
            String database,
            String tableName
    ) throws SQLException {
        return new TableDdlResult(loadMetadataDdl(connection, owner(database), tableName, "TABLE"));
    }

    @Override
    public TableDdlResult loadViewDdl(
            Connection connection,
            ConnectionEntity entity,
            String database,
            String viewName
    ) throws SQLException {
        return new TableDdlResult(loadMetadataDdl(connection, owner(database), viewName, "VIEW"));
    }

    private TablePropertiesResult loadRelationProperties(
            Connection connection,
            ConnectionEntity entity,
            String database,
            String relationName,
            boolean view
    ) throws SQLException {
        String schemaOwner = owner(database);
        String objectName = dictionaryName(relationName);
        String comment = loadObjectComment(connection, schemaOwner, objectName);
        List<TableColumnDetail> columns = loadColumns(connection, schemaOwner, objectName);
        SchemaScope scope = new SchemaScope(schemaOwner, schemaOwner, schemaOwner);
        List<TableForeignKeyDetail> foreignKeys = view
                ? List.of()
                : TableMetadataSupport.mapForeignKeys(TableMetadataLoader.loadForeignKeyNodes(
                connection.getMetaData(), "", scope.catalogPattern(), relationName, scope
        ));
        List<TableIndexDetail> indexes = view
                ? List.of()
                : TableMetadataSupport.mapIndexes(TableMetadataLoader.loadIndexNodes(
                connection.getMetaData(), "", scope.catalogPattern(), relationName, scope
        ));
        return new TablePropertiesResult(
                relationName,
                comment,
                null,
                null,
                null,
                null,
                columns,
                foreignKeys,
                indexes
        );
    }

    private List<TableColumnDetail> loadColumns(Connection connection, String schemaOwner, String objectName)
            throws SQLException {
        List<TableColumnDetail> columns = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement("""
                SELECT c.column_id,
                       c.column_name,
                       c.data_type,
                       c.data_length,
                       c.data_precision,
                       c.data_scale,
                       c.nullable,
                       c.data_default,
                       cc.comments
                FROM all_tab_columns c
                LEFT JOIN all_col_comments cc
                    ON cc.owner = c.owner AND cc.table_name = c.table_name AND cc.column_name = c.column_name
                WHERE c.owner = ? AND c.table_name = ?
                ORDER BY c.column_id
                """)) {
            ps.setString(1, schemaOwner);
            ps.setString(2, objectName);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    columns.add(new TableColumnDetail(
                            rs.getInt("column_id"),
                            rs.getString("column_name"),
                            formatDataType(
                                    rs.getString("data_type"),
                                    rs.getObject("data_length"),
                                    rs.getObject("data_precision"),
                                    rs.getObject("data_scale")
                            ),
                            "Y".equalsIgnoreCase(rs.getString("nullable")),
                            false,
                            null,
                            TableMetadataSupport.blankToNull(rs.getString("data_default")),
                            null,
                            TableMetadataSupport.blankToNull(rs.getString("comments"))
                    ));
                }
            }
        }
        return columns;
    }

    private String loadObjectComment(Connection connection, String schemaOwner, String objectName)
            throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement("""
                SELECT comments
                FROM all_tab_comments
                WHERE owner = ? AND table_name = ?
                """)) {
            ps.setString(1, schemaOwner);
            ps.setString(2, objectName);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return TableMetadataSupport.blankToNull(rs.getString("comments"));
                }
            }
        }
        return null;
    }

    private String loadMetadataDdl(
            Connection connection,
            String schemaOwner,
            String objectName,
            String objectType
    ) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement("""
                SELECT DBMS_METADATA.GET_DDL(?, ?, ?) AS ddl
                FROM dual
                """)) {
            ps.setString(1, objectType);
            ps.setString(2, objectName);
            ps.setString(3, schemaOwner);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalArgumentException(objectType + " not found: " + schemaOwner + "." + objectName);
                }
                String ddl = readClob(rs, "ddl");
                if (ddl == null || ddl.isBlank()) {
                    throw new IllegalArgumentException("DDL is not available for: " + schemaOwner + "." + objectName);
                }
                return ddl.trim();
            }
        }
    }

    private static String owner(String database) {
        if (database == null || database.isBlank()) {
            throw new IllegalArgumentException("DB2 schema owner is required");
        }
        return database.trim().toUpperCase(Locale.ROOT);
    }

    private static String dictionaryName(String relationName) {
        return relationName == null ? "" : relationName.trim().toUpperCase(Locale.ROOT);
    }

    private static String readClob(ResultSet rs, String column) throws SQLException {
        Object value = rs.getObject(column);
        if (value == null) {
            return null;
        }
        if (value instanceof Clob clob) {
            long length = clob.length();
            if (length <= 0) {
                return "";
            }
            return clob.getSubString(1, (int) Math.min(length, Integer.MAX_VALUE));
        }
        return value.toString();
    }

    private static String formatDataType(
            String dataType,
            Object dataLength,
            Object precision,
            Object scale
    ) {
        if (dataType == null || dataType.isBlank()) {
            return "";
        }
        String normalized = dataType.toUpperCase(Locale.ROOT);
        if (normalized.contains("CHAR") && dataLength instanceof Number length && length.intValue() > 0) {
            return normalized + "(" + length.intValue() + ")";
        }
        if ((normalized.contains("NUMBER") || normalized.contains("DECIMAL"))
                && precision instanceof Number prec
                && prec.intValue() > 0) {
            int scaleValue = scale instanceof Number scaleNumber ? scaleNumber.intValue() : 0;
            return normalized + "(" + prec.intValue() + "," + scaleValue + ")";
        }
        return normalized;
    }
}
