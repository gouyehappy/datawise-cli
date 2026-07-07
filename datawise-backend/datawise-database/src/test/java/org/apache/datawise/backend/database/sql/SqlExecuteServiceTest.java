package org.apache.datawise.backend.database.sql;

import org.apache.datawise.backend.connector.ConnectorCapability;
import org.apache.datawise.backend.connector.DataSourceConnector;
import org.apache.datawise.backend.connector.facade.catalog.ConnectorCatalogAccess;
import org.apache.datawise.backend.connector.facade.jdbc.ConnectorJdbcAccess;
import org.apache.datawise.backend.connector.facade.jdbc.ConnectorJdbcSessionAccess;
import org.apache.datawise.backend.connector.facade.ops.ConnectorOpsAccess;
import org.apache.datawise.backend.connector.hook.SqlExecutionHookRunner;
import org.apache.datawise.backend.config.DatawiseQueryProperties;
import org.apache.datawise.backend.database.context.ConnectionExecutionContext;
import org.apache.datawise.backend.domain.ExecuteSqlRequest;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.backend.jdbc.session.JdbcManualSessionStore.ManagedSession;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.service.ConnectionAccessService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.EnumSet;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SqlExecuteServiceTest {

    @Mock
    private ConnectionExecutionContext connectionContext;
    @Mock
    private org.apache.datawise.backend.connector.facade.ConnectorFacade connectorFacade;
    @Mock
    private ConnectionAccessService connectionAccessService;
    @Mock
    private SqlCursorService sqlCursorService;
    @Mock
    private ConnectorJdbcAccess jdbcAccess;
    @Mock
    private ConnectorJdbcSessionAccess jdbcSessionAccess;
    @Mock
    private ConnectorCatalogAccess catalogAccess;
    @Mock
    private ConnectorOpsAccess opsAccess;
    @Mock
    private DataSourceConnector connector;
    @Mock
    private ManagedSession managedSession;

    private SqlExecutionHookRunner sqlExecutionHookRunner;

    private SqlExecuteService service;

    @BeforeEach
    void setUp() {
        sqlExecutionHookRunner = new SqlExecutionHookRunner(List.of());
        service = new SqlExecuteService(
                connectionContext,
                connectorFacade,
                new QueryLimitResolver(unlimitedQueryProperties()),
                connectionAccessService,
                sqlCursorService,
                sqlExecutionHookRunner
        );
    }

    @Test
    void execute_withCursorId_delegatesToCursorService() {
        ExecuteSqlRequest request = new ExecuteSqlRequest(
                null,
                "conn-1",
                null,
                null,
                null,
                100,
                "cursor-1",
                null
        );
        ExecuteSqlResult expected = new ExecuteSqlResult(
                "select 1", 1, 0, null, null, null, null, null, false, 0, 100
        );
        when(sqlCursorService.fetchCursorPage("cursor-1", 100)).thenReturn(expected);

        ExecuteSqlResult result = service.execute(request);

        assertEquals(expected, result);
        verify(sqlCursorService).fetchCursorPage("cursor-1", 100);
    }

    @Test
    void execute_rejectsBlankSql() {
        ExecuteSqlRequest request = new ExecuteSqlRequest("   ", "conn-1", null, null, null, null, null, null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.execute(request));
        assertEquals("SQL is required", ex.getMessage());
    }

    @Test
    void execute_rejectsMissingConnectionId() {
        ExecuteSqlRequest request = new ExecuteSqlRequest("select 1", null, null, null, null, null, null, null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.execute(request));
        assertEquals("connectionId is required", ex.getMessage());
    }

    @Test
    void execute_enforcesSqlWriteAccessForMutatingStatements() {
        ConnectionEntity entity = connectionEntity();
        when(connectionContext.requireAvailableConnectionForCurrentUser(
                "conn-1",
                "Connection not found: conn-1"
        )).thenReturn(new ConnectionExecutionContext.ResolvedConnection(9L, entity));
        doThrow(new IllegalArgumentException("Read-only access for connection: conn-1"))
                .when(connectionAccessService)
                .requireSqlWriteAccess(9L, "conn-1", "delete from users");

        ExecuteSqlRequest request = new ExecuteSqlRequest(
                "delete from users",
                "conn-1",
                null,
                null,
                null,
                null,
                null,
                null
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.execute(request));
        assertEquals("Read-only access for connection: conn-1", ex.getMessage());
        verify(connectionAccessService).requireSqlWriteAccess(9L, "conn-1", "delete from users");
    }

    @Test
    void execute_rejectsMissingManualSessionInsteadOfAutocommitFallback() throws Exception {
        ConnectionEntity entity = connectionEntity();
        when(connectionContext.requireAvailableConnectionForCurrentUser(
                "conn-1",
                "Connection not found: conn-1"
        )).thenReturn(new ConnectionExecutionContext.ResolvedConnection(9L, entity));
        stubSqlCapabilities(entity);
        when(connectorFacade.jdbc()).thenReturn(jdbcAccess);
        when(jdbcAccess.session()).thenReturn(jdbcSessionAccess);
        when(jdbcSessionAccess.requireManualSession(9L, "tab-1")).thenReturn(managedSession);
        when(jdbcSessionAccess.executeInManualSession(
                eq(9L),
                eq("tab-1"),
                eq(entity),
                isNull(),
                eq("update users set active = 1"),
                anyInt(),
                anyString()
        )).thenReturn(null);

        ExecuteSqlRequest request = new ExecuteSqlRequest(
                "update users set active = 1",
                "conn-1",
                null,
                null,
                "tab-1",
                null,
                null,
                null
        );

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.execute(request));
        assertEquals("SQL session not found or already closed", ex.getMessage());
    }

    private void stubSqlCapabilities(ConnectionEntity entity) {
        when(connectorFacade.catalog()).thenReturn(catalogAccess);
        when(connectorFacade.ops()).thenReturn(opsAccess);
        when(opsAccess.registry()).thenReturn(null);
        when(catalogAccess.resolve(entity)).thenReturn(connector);
        when(connector.capabilities()).thenReturn(EnumSet.of(ConnectorCapability.SQL_EXECUTE));
    }

    private static ConnectionEntity connectionEntity() {
        ConnectionEntity entity = new ConnectionEntity();
        entity.setId("conn-1");
        entity.setDbType("mysql");
        return entity;
    }

    private static DatawiseQueryProperties unlimitedQueryProperties() {
        DatawiseQueryProperties properties = new DatawiseQueryProperties();
        properties.setMaxResultRows(0);
        return properties;
    }
}
