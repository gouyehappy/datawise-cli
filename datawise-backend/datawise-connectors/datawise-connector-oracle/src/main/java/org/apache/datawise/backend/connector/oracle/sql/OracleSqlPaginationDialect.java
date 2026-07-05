package org.apache.datawise.backend.connector.oracle.sql;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.jdbc.execution.pagination.AbstractSqlPaginationDialect;

/** Oracle 12c+ {@code OFFSET n ROWS FETCH NEXT m ROWS ONLY}. */
public final class OracleSqlPaginationDialect extends AbstractSqlPaginationDialect {

    @Override
    public boolean supports(String dbType) {
        return DbType.ORACLE.id().equalsIgnoreCase(DbType.normalizeId(dbType));
    }

    @Override
    public int priority() {
        return 21;
    }

    @Override
    protected String paginationClause(int limit, int offset) {
        return " OFFSET " + offset + " ROWS FETCH NEXT " + limit + " ROWS ONLY";
    }
}
