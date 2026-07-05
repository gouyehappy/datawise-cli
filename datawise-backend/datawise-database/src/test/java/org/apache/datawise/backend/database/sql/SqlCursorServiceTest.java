package org.apache.datawise.backend.database.sql;

import org.apache.datawise.backend.database.context.ConnectionExecutionContext;

import org.apache.datawise.backend.config.DatawiseQueryProperties;
import org.apache.datawise.backend.connector.facade.ConnectorFacade;
import org.apache.datawise.backend.connector.facade.jdbc.ConnectorJdbcAccess;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.database.sql.QueryLimitResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SqlCursorServiceTest {

    @Mock
    private ConnectionExecutionContext connectionContext;
    @Mock
    private ConnectorFacade connectorFacade;
    @Mock
    private ConnectorJdbcAccess jdbcAccess;
    @Mock
    private SqlResultCursorStore cursorStore;

    private SqlCursorService service;

    @BeforeEach
    void setUp() {
        service = new SqlCursorService(
                connectionContext,
                connectorFacade,
                new QueryLimitResolver(unlimitedQueryProperties()),
                cursorStore
        );
    }

    @Test
    void resolvePageSize_usesClientLimitWhenServerUnlimited() {
        assertEquals(200, service.resolvePageSize(200));
    }

    @Test
    void resolvePageSize_fallsBackToDefaultWhenMissing() {
        assertEquals(SqlCursorService.DEFAULT_PAGE_SIZE, service.resolvePageSize(null));
        assertEquals(SqlCursorService.DEFAULT_PAGE_SIZE, service.resolvePageSize(0));
    }

    @Test
    void executePagedFirstPage_returnsPageWithoutCursorWhenNoMoreRows() throws SQLException {
        when(connectorFacade.jdbc()).thenReturn(jdbcAccess);
        ConnectionEntity entity = connectionEntity("conn-1");
        List<Map<String, Object>> rows = List.of(Map.of("id", 1));
        ExecuteSqlResult raw = new ExecuteSqlResult(
                "select * from t",
                1,
                5,
                List.of(Map.of("name", "id")),
                rows,
                null,
                null,
                null,
                null,
                null,
                null
        );
        when(jdbcAccess.execute(entity, "select * from t", "shop", 501)).thenReturn(raw);

        ExecuteSqlResult page = service.executePagedFirstPage(1L, entity, "shop", "select * from t", 500);

        assertEquals(1, page.rowCount());
        assertFalse(Boolean.TRUE.equals(page.hasMore()));
        assertNull(page.cursorId());
        verify(jdbcAccess).execute(entity, "select * from t", "shop", 501);
    }

    @Test
    void executePagedFirstPage_createsCursorWhenMoreRowsExist() throws SQLException {
        when(connectorFacade.jdbc()).thenReturn(jdbcAccess);
        ConnectionEntity entity = connectionEntity("conn-1");
        List<Map<String, Object>> columns = List.of(Map.of("name", "id"));
        List<Map<String, Object>> rows = List.of(Map.of("id", 1), Map.of("id", 2));
        ExecuteSqlResult raw = new ExecuteSqlResult(
                "select * from t",
                2,
                5,
                columns,
                rows,
                null,
                null,
                null,
                null,
                null,
                null
        );
        when(jdbcAccess.execute(entity, "select * from t", "shop", 2)).thenReturn(raw);
        when(cursorStore.create(eq(1L), eq("conn-1"), eq("shop"), eq("select * from t"), eq(null), eq(1), eq(1), eq(columns)))
                .thenReturn("cursor-abc");

        ExecuteSqlResult page = service.executePagedFirstPage(1L, entity, "shop", "select * from t", 1);

        assertEquals("cursor-abc", page.cursorId());
        assertEquals(1, page.rowCount());
        verify(cursorStore).create(1L, "conn-1", "shop", "select * from t", null, 1, 1, columns);
    }

    private static ConnectionEntity connectionEntity(String id) {
        ConnectionEntity entity = new ConnectionEntity();
        entity.setId(id);
        entity.setDbType("mysql");
        return entity;
    }

    private static DatawiseQueryProperties unlimitedQueryProperties() {
        DatawiseQueryProperties properties = new DatawiseQueryProperties();
        properties.setMaxResultRows(0);
        return properties;
    }
}
