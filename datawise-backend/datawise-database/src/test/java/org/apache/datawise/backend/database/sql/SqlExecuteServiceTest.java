package org.apache.datawise.backend.database.sql;

import org.apache.datawise.backend.connector.hook.SqlExecutionHookRunner;
import org.apache.datawise.backend.database.context.ConnectionExecutionContext;
import org.apache.datawise.backend.service.ConnectionAccessService;

import org.apache.datawise.backend.config.DatawiseQueryProperties;
import org.apache.datawise.backend.domain.ExecuteSqlRequest;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.database.sql.QueryLimitResolver;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

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
