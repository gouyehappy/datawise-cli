package org.apache.datawise.backend.jdbc.execution.pagination;

import org.apache.datawise.backend.jdbc.execution.SqlPaginationClauseSupport;
import org.apache.datawise.backend.sql.spi.SqlPaginationDialect;

public abstract class AbstractSqlPaginationDialect implements SqlPaginationDialect {

    @Override
    public final String applyLimitOffset(String sql, int limit, int offset) {
        SqlPaginationClauseSupport.validateLimitOffset(limit, offset);
        return SqlPaginationClauseSupport.appendClause(sql, paginationClause(limit, offset));
    }

    protected abstract String paginationClause(int limit, int offset);
}
