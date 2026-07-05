package org.apache.datawise.backend.jdbc.support;

import com.zaxxer.hikari.HikariConfig;
import org.apache.datawise.backend.model.ConnectionEntity;

/**
 * HikariCP 池参数：按数据库族设置连接校验与生命周期，降低池内陈旧连接（尤其 Doris FE 空闲断连）。
 */
public final class HikariJdbcPoolTuning {

    private static final String MYSQL_PROTOCOL_TEST_QUERY = "SELECT 1";
    private static final String POSTGRESQL_TEST_QUERY = "SELECT 1";

    private HikariJdbcPoolTuning() {
    }

    public static void apply(HikariConfig config, ConnectionEntity entity) {
        String dbType = DbTypeFamilies.normalize(entity.getDbType());
        if (DbTypeFamilies.isMysqlProtocol(dbType)) {
            config.setConnectionTestQuery(MYSQL_PROTOCOL_TEST_QUERY);
            config.addDataSourceProperty("cachePrepStmts", "true");
            config.addDataSourceProperty("prepStmtCacheSize", "250");
            config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
            config.addDataSourceProperty("useServerPrepStmts", "true");
            if (DbTypeFamilies.isOlapFamily(dbType)) {
                config.setMaxLifetime(300_000);
                config.setKeepaliveTime(60_000);
                config.setIdleTimeout(120_000);
            }
            return;
        }
        if (DbTypeFamilies.isPostgresqlFamily(dbType)) {
            config.setConnectionTestQuery(POSTGRESQL_TEST_QUERY);
        }
    }
}
