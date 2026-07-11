package org.apache.datawise.backend.database.connection;

import org.apache.datawise.backend.config.ConnectionLifecycleProperties;
import org.apache.datawise.backend.database.explorer.ExplorerConnectionLifecycleService;
import org.apache.datawise.backend.jdbc.connection.ConnectionActivityRegistry;
import org.apache.datawise.backend.jdbc.support.JdbcConnectionPoolManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConnectionIdleEvictionServiceTest {

    @Mock
    private JdbcConnectionPoolManager poolManager;
    @Mock
    private ConnectionActivityRegistry activityRegistry;
    @Mock
    private ExplorerConnectionLifecycleService connectionLifecycleService;

    private ConnectionLifecycleProperties properties;
    private ConnectionIdleEvictionService service;

    @BeforeEach
    void setUp() {
        properties = new ConnectionLifecycleProperties();
        properties.setIdleEvictEnabled(true);
        properties.setIdleEvictMs(900_000);
        service = new ConnectionIdleEvictionService(
                properties,
                poolManager,
                activityRegistry,
                connectionLifecycleService
        );
    }

    @Test
    void evictIdleConnectionsScheduled_evictsStalePooledConnections() {
        when(poolManager.listPooledConnectionIds()).thenReturn(List.of("conn-stale", "conn-active"));
        when(activityRegistry.getLastActivityMs("conn-stale")).thenReturn(System.currentTimeMillis() - 2_000_000L);
        when(activityRegistry.getLastActivityMs("conn-active")).thenReturn(System.currentTimeMillis());

        service.evictIdleConnectionsScheduled();

        verify(connectionLifecycleService).evictIdleResources("conn-stale");
        verify(connectionLifecycleService, never()).evictIdleResources("conn-active");
    }

    @Test
    void evictIdleConnectionsScheduled_skipsWhenDisabled() {
        properties.setIdleEvictEnabled(false);

        service.evictIdleConnectionsScheduled();

        verify(poolManager, never()).listPooledConnectionIds();
    }
}
