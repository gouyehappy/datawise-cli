package org.apache.datawise.backend.database.runtime;

import org.apache.datawise.backend.jdbc.support.JdbcDriverConnectionFactory;
import org.apache.datawise.backend.service.ConnectionRuntimeCleanup;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DefaultConnectionRuntimeCleanup implements ConnectionRuntimeCleanup {

    private final JdbcDriverConnectionFactory jdbcDriverConnectionFactory;

    public DefaultConnectionRuntimeCleanup(JdbcDriverConnectionFactory jdbcDriverConnectionFactory) {
        this.jdbcDriverConnectionFactory = jdbcDriverConnectionFactory;
    }

    @Override
    public void onSessionCleanup(String sessionId, boolean guest, List<String> connectionIds) {
        for (String connectionId : connectionIds) {
            jdbcDriverConnectionFactory.evictPool(connectionId);
        }
    }
}
