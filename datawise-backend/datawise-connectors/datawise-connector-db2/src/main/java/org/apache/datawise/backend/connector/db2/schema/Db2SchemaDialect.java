package org.apache.datawise.backend.connector.db2.schema;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.schema.SchemaDialect;
import org.apache.datawise.backend.schema.SchemaScope;

import java.sql.Connection;
import java.util.Locale;
import java.util.Set;

/** DB2 schema dialect: explorer database nodes map to owner/schema names. */
public class Db2SchemaDialect implements SchemaDialect {

    private static final Set<String> SYSTEM_SCHEMAS = Set.of(
            "SYSIBM",
            "SYSCAT",
            "SYSFUN",
            "SYSPROC",
            "SYSSTAT",
            "SYSTOOLS"
    );

    @Override
    public String id() {
        return DbType.DB2.id();
    }

    @Override
    public boolean supports(String dbType) {
        return DbType.isDb2Family(dbType);
    }

    @Override
    public SchemaScope resolveScope(Connection connection, String catalogLabel) {
        return new SchemaScope(catalogLabel, catalogLabel, catalogLabel);
    }

    @Override
    public boolean isSystemSchema(String schema) {
        if (schema == null || schema.isBlank()) {
            return true;
        }
        String value = schema.trim().toUpperCase(Locale.ROOT);
        return SYSTEM_SCHEMAS.contains(value);
    }
}
