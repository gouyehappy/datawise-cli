package org.apache.datawise.backend.connector.sqlserver.schema;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.schema.SchemaDialect;
import org.apache.datawise.backend.schema.SchemaScope;

import java.sql.Connection;
import java.util.Locale;
import java.util.Set;

public class SqlServerSchemaDialect implements SchemaDialect {

    private static final Set<String> SYSTEM_CATALOGS = Set.of(
            "master", "tempdb", "model", "msdb"
    );

    private static final Set<String> SYSTEM_SCHEMAS = Set.of(
            "information_schema",
            "sys",
            "guest",
            "db_owner",
            "db_accessadmin",
            "db_securityadmin",
            "db_ddladmin",
            "db_backupoperator",
            "db_datareader",
            "db_datawriter",
            "db_denydatareader",
            "db_denydatawriter"
    );

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

    @Override
    public boolean isSystemCatalog(String catalog) {
        return catalog != null && SYSTEM_CATALOGS.contains(catalog.toLowerCase(Locale.ROOT));
    }

    @Override
    public boolean isSystemSchema(String schema) {
        return schema != null && SYSTEM_SCHEMAS.contains(schema.toLowerCase(Locale.ROOT));
    }
}
