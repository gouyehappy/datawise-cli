package org.apache.datawise.backend.jdbc.execution;

import org.apache.datawise.backend.jdbc.execution.pagination.LimitOffsetSqlPaginationDialect;
import org.apache.datawise.backend.sql.spi.SqlPaginationService;

/** 无 Spring 容器时的分页回退（MySQL 风格 LIMIT/OFFSET）。 */
final class FallbackSqlPaginationService implements SqlPaginationService {

    static final SqlPaginationService INSTANCE = new FallbackSqlPaginationService();

    private final LimitOffsetSqlPaginationDialect dialect = new LimitOffsetSqlPaginationDialect();

    private FallbackSqlPaginationService() {
    }

    @Override
    public String applyLimitOffset(String sql, String dbType, int limit, int offset) {
        return dialect.applyLimitOffset(sql, limit, offset);
    }
}
