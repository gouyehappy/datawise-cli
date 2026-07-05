package org.apache.datawise.backend.schema;

import java.sql.Connection;

/**
 * 各数据库在 JDBC {@link java.sql.DatabaseMetaData} 上的 catalog/schema 映射差异。
 */
public interface SchemaDialect {

    String id();

    boolean supports(String dbType);

    SchemaScope resolveScope(Connection connection, String catalogLabel) throws java.sql.SQLException;

    default boolean isSystemCatalog(String catalog) {
        return false;
    }

    default boolean isSystemSchema(String schema) {
        return false;
    }

    /** Trino / Presto 等 catalog → schema → table 三层结构。 */
    default boolean usesCatalogSchemaHierarchy() {
        return false;
    }

    default SchemaScope resolveScope(Connection connection, String catalog, String schema) throws java.sql.SQLException {
        if (schema != null && !schema.isBlank()) {
            return new SchemaScope(catalog, schema, catalog + "." + schema);
        }
        return resolveScope(connection, catalog);
    }
}
