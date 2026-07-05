package org.apache.datawise.backend.database.connection;

import org.apache.datawise.backend.config.JdbcPoolProperties;
import org.apache.datawise.backend.jdbc.support.JdbcDriverConnectionFactory;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.sql.Connection;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JdbcConnectionPoolWarmupServiceTest {

    @Mock
    private JdbcDriverConnectionFactory connectionFactory;
    @Mock
    private Connection connection;

    private JdbcConnectionPoolWarmupService service;

    @BeforeEach
    void setUp() {
        JdbcPoolProperties properties = new JdbcPoolProperties();
        properties.setMinimumIdle(2);
        service = new JdbcConnectionPoolWarmupService(connectionFactory, properties);
    }

    @Test
    void warmup_skipsNonJdbcDataSources() throws SQLException {
        ConnectionEntity entity = entity("conn-redis", "redis");

        JdbcConnectionPoolWarmupService.WarmupResult result = service.warmup(entity);

        assertTrue(result.skipped());
        verify(connectionFactory, never()).open(entity);
    }

    @Test
    void warmup_borrowsUpToMinimumIdle() throws SQLException {
        ConnectionEntity entity = entity("conn-mysql", "mysql");
        when(connectionFactory.open(entity)).thenReturn(connection);
        when(connection.isValid(3)).thenReturn(true);

        JdbcConnectionPoolWarmupService.WarmupResult result = service.warmup(entity);

        assertEquals(2, result.warmed());
        assertEquals(2, result.target());
        verify(connectionFactory, times(2)).open(entity);
        verify(connection, times(2)).close();
    }

    private static ConnectionEntity entity(String id, String dbType) {
        ConnectionEntity entity = new ConnectionEntity();
        entity.setId(id);
        entity.setDbType(dbType);
        return entity;
    }
}
