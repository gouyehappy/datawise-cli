package org.apache.datawise.backend.connector.sqlserver.support;

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

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** SQL Server table/view metadata via information_schema + sys catalog views. */
public class SqlServerTableIntrospector implements TableMetadataIntrospection {

    private static final String DEFAULT_SCHEMA = "dbo";

    @Override
    public boolean supports(String dbType) {
        return DbType.isSqlServerFamily(dbType);
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
        return new TableDdlResult(loadObjectDefinition(connection, DEFAULT_SCHEMA, tableName));
    }

    @Override
    public TableDdlResult loadViewDdl(
            Connection connection,
            ConnectionEntity entity,
            String database,
            String viewName
    ) throws SQLException {
        return loadDdl(connection, entity, database, viewName);
    }

    private TablePropertiesResult loadRelationProperties(
            Connection connection,
            ConnectionEntity entity,
            String database,
            String relationName,
            boolean view
    ) throws SQLException {
        String catalog = TableMetadataSupport.resolveCatalog(connection, entity, database);
        String comment = loadRelationComment(connection, DEFAULT_SCHEMA, relationName);
        List<TableColumnDetail> columns = loadColumns(connection, catalog, DEFAULT_SCHEMA, relationName);
        SchemaScope scope = new SchemaScope(catalog, DEFAULT_SCHEMA, catalog);
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

    private List<TableColumnDetail> loadColumns(
            Connection connection,
            String catalog,
            String schema,
            String tableName
    ) throws SQLException {
        List<TableColumnDetail> columns = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement("""
                SELECT c.ORDINAL_POSITION, c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE,
                       c.COLUMN_DEFAULT, c.CHARACTER_MAXIMUM_LENGTH, c.NUMERIC_PRECISION, c.NUMERIC_SCALE,
                       CAST(ep.value AS NVARCHAR(4000)) AS COLUMN_COMMENT
                FROM INFORMATION_SCHEMA.COLUMNS c
                LEFT JOIN sys.columns sc
                    ON sc.object_id = OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME))
                    AND sc.name = c.COLUMN_NAME
                LEFT JOIN sys.extended_properties ep
                    ON ep.major_id = sc.object_id AND ep.minor_id = sc.column_id AND ep.name = 'MS_Description'
                WHERE c.TABLE_CATALOG = ? AND c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
                ORDER BY c.ORDINAL_POSITION
                """)) {
            ps.setString(1, catalog);
            ps.setString(2, schema);
            ps.setString(3, tableName);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String dataType = formatSqlServerDataType(
                            rs.getString("DATA_TYPE"),
                            rs.getObject("CHARACTER_MAXIMUM_LENGTH"),
                            rs.getObject("NUMERIC_PRECISION"),
                            rs.getObject("NUMERIC_SCALE")
                    );
                    columns.add(new TableColumnDetail(
                            rs.getInt("ORDINAL_POSITION"),
                            rs.getString("COLUMN_NAME"),
                            dataType,
                            "YES".equalsIgnoreCase(rs.getString("IS_NULLABLE")),
                            false,
                            null,
                            TableMetadataSupport.blankToNull(rs.getString("COLUMN_DEFAULT")),
                            null,
                            TableMetadataSupport.blankToNull(rs.getString("COLUMN_COMMENT"))
                    ));
                }
            }
        }
        return columns;
    }

    private String loadRelationComment(Connection connection, String schema, String relationName)
            throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement("""
                SELECT CAST(ep.value AS NVARCHAR(4000)) AS comment_text
                FROM sys.objects o
                INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
                LEFT JOIN sys.extended_properties ep
                    ON ep.major_id = o.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
                WHERE s.name = ? AND o.name = ? AND o.type IN ('U', 'V')
                """)) {
            ps.setString(1, schema);
            ps.setString(2, relationName);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return TableMetadataSupport.blankToNull(rs.getString("comment_text"));
                }
            }
        }
        return null;
    }

    private String loadObjectDefinition(Connection connection, String schema, String objectName)
            throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement("""
                SELECT sm.definition
                FROM sys.sql_modules sm
                INNER JOIN sys.objects o ON sm.object_id = o.object_id
                INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
                WHERE s.name = ? AND o.name = ? AND o.type IN ('U', 'V')
                """)) {
            ps.setString(1, schema);
            ps.setString(2, objectName);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalArgumentException("Object not found: " + schema + "." + objectName);
                }
                String ddl = rs.getString("definition");
                if (ddl == null || ddl.isBlank()) {
                    throw new IllegalArgumentException("DDL is not available for: " + schema + "." + objectName);
                }
                return ddl.trim();
            }
        }
    }

    private static String formatSqlServerDataType(
            String dataType,
            Object charLength,
            Object precision,
            Object scale
    ) {
        if (dataType == null || dataType.isBlank()) {
            return "";
        }
        String normalized = dataType.toLowerCase(Locale.ROOT);
        if (charLength instanceof Number number && number.intValue() > 0
                && (normalized.contains("char") || normalized.contains("binary"))) {
            return dataType + "(" + number.intValue() + ")";
        }
        if (precision instanceof Number prec && prec.intValue() > 0
                && (normalized.contains("decimal") || normalized.contains("numeric"))) {
            int scaleValue = scale instanceof Number scaleNumber ? scaleNumber.intValue() : 0;
            return dataType + "(" + prec.intValue() + "," + scaleValue + ")";
        }
        return dataType;
    }
}
