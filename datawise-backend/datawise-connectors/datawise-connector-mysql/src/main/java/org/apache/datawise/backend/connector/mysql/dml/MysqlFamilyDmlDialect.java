package org.apache.datawise.backend.connector.mysql.dml;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.dml.render.AbstractJdbcDmlDialect;
import org.apache.datawise.backend.dml.render.DmlSqlSupport;

/** MySQL 协议族 DML（mysql / mariadb / doris / starrocks / oceanbase / tidb 等）。 */
public final class MysqlFamilyDmlDialect extends AbstractJdbcDmlDialect {

    @Override
    public String dialectId() {
        return "mysql-family";
    }

    @Override
    public boolean supports(String dbType) {
        return DbType.isMysqlProtocol(dbType);
    }

    @Override
    public int priority() {
        return 20;
    }

    @Override
    public String quoteIdentifier(String name) {
        return DbType.MYSQL.quoteName(DmlSqlSupport.sanitizeIdentifier(name));
    }

    @Override
    public String qualifiedTable(String database, String tableName) {
        return DbType.quoteQualifiedTable(DbType.MYSQL.id(), database, tableName);
    }
}
