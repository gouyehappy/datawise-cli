package org.apache.datawise.backend.sql;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.connector.ConnectorPluginContributionHolder;
import org.apache.datawise.backend.connector.spi.ConnectorDialectContributions;
import org.apache.datawise.backend.jdbc.execution.SqlPaginationClauseSupport;
import org.apache.datawise.backend.jdbc.execution.pagination.LimitOffsetSqlPaginationDialect;
import org.apache.datawise.backend.sql.pagination.SqlServerSqlPaginationDialect;
import org.apache.datawise.backend.sql.spi.SqlPaginationDialect;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SqlPaginationDialectRegistryTest {

    @Test
    void applyLimitOffset_usesCatalogSchemaDialectFromPlugins() {
        ConnectorPluginContributionHolder holder = new ConnectorPluginContributionHolder();
        holder.setContributions(new ConnectorDialectContributions(
                List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), List.of(),
                List.of(new CatalogSchemaPaginationDialect()),
                List.of()
        ));
        SqlPaginationDialectRegistry registry = new SqlPaginationDialectRegistry(
                List.of(new LimitOffsetSqlPaginationDialect(), new SqlServerSqlPaginationDialect()),
                holder
        );
        String sql = "SELECT * FROM \"hive\".\"a003\".\"t\"";
        assertEquals(
                "SELECT * FROM \"hive\".\"a003\".\"t\" LIMIT 501",
                registry.applyLimitOffset(sql, "trino", 501, 0)
        );
    }

    @Test
    void applyLimitOffset_usesSqlServerSyntax() {
        SqlPaginationDialectRegistry registry = new SqlPaginationDialectRegistry(
                List.of(new LimitOffsetSqlPaginationDialect(), new SqlServerSqlPaginationDialect()),
                new ConnectorPluginContributionHolder()
        );
        assertEquals(
                "SELECT * FROM users OFFSET 0 ROWS FETCH NEXT 501 ROWS ONLY",
                registry.applyLimitOffset("SELECT * FROM users", "sqlserver", 501, 0)
        );
    }

    /** 模拟 Trino/Presto 插件贡献，避免 connector-api 测试依赖 connector-trino。 */
    private static final class CatalogSchemaPaginationDialect implements SqlPaginationDialect {

        @Override
        public boolean supports(String dbType) {
            return DbType.isCatalogSchemaFamily(dbType);
        }

        @Override
        public int priority() {
            return 24;
        }

        @Override
        public String applyLimitOffset(String sql, int limit, int offset) {
            SqlPaginationClauseSupport.validateLimitOffset(limit, offset);
            String clause = offset <= 0
                    ? " LIMIT " + limit
                    : " OFFSET " + offset + " LIMIT " + limit;
            return SqlPaginationClauseSupport.appendClause(sql, clause);
        }
    }
}
