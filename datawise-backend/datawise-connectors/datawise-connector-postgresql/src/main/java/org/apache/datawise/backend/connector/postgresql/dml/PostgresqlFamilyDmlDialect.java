package org.apache.datawise.backend.connector.postgresql.dml;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.dml.render.AbstractJdbcDmlDialect;
import org.apache.datawise.backend.dml.render.DmlSqlSupport;

/** PostgreSQL 协议族 DML（postgresql / kingbase / greenplum / opengauss / highgo）。 */
public final class PostgresqlFamilyDmlDialect extends AbstractJdbcDmlDialect {

    @Override
    public String dialectId() {
        return "postgresql";
    }

    @Override
    public boolean supports(String dbType) {
        return DbType.isPostgresqlFamily(dbType);
    }

    @Override
    public int priority() {
        return 21;
    }

    @Override
    public String quoteIdentifier(String name) {
        return DbType.POSTGRESQL.quoteName(DmlSqlSupport.sanitizeIdentifier(name));
    }

    @Override
    public String qualifiedTable(String database, String tableName) {
        return DbType.quoteQualifiedTable(DbType.POSTGRESQL.id(), database, tableName);
    }
}
