package org.apache.datawise.backend.jdbc.execution;

import org.apache.datawise.backend.domain.TableDataResult;
import org.junit.jupiter.api.Test;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JdbcResultSetMapperTest {

    @Test
    void mapPage_fullPageWithoutProbeRow_assumesHasMore() throws Exception {
        ResultSet rs = mockResultSet(List.of(1, 2, 3), 3);

        TableDataResult page = JdbcResultSetMapper.mapPage(rs, 3);

        assertEquals(3, page.rows().size());
        assertTrue(Boolean.TRUE.equals(page.hasMore()));
    }

    @Test
    void mapPage_probeRowPresent_trimsAndSetsHasMore() throws Exception {
        ResultSet rs = mockResultSet(List.of(1, 2, 3, 4), 3);

        TableDataResult page = JdbcResultSetMapper.mapPage(rs, 3);

        assertEquals(3, page.rows().size());
        assertTrue(Boolean.TRUE.equals(page.hasMore()));
    }

    @Test
    void mapPage_partialPage_hasNoMore() throws Exception {
        ResultSet rs = mockResultSet(List.of(1, 2), 3);

        TableDataResult page = JdbcResultSetMapper.mapPage(rs, 3);

        assertEquals(2, page.rows().size());
        assertEquals(false, page.hasMore());
    }

    private static ResultSet mockResultSet(List<Integer> ids, int unused) throws Exception {
        ResultSet rs = mock(ResultSet.class);
        ResultSetMetaData meta = mock(ResultSetMetaData.class);
        when(meta.getColumnCount()).thenReturn(1);
        when(meta.getColumnLabel(1)).thenReturn("id");
        when(meta.getColumnName(1)).thenReturn("id");
        when(meta.getColumnType(1)).thenReturn(Types.INTEGER);
        when(rs.getMetaData()).thenReturn(meta);

        List<Integer> copy = new ArrayList<>(ids);
        when(rs.next()).thenAnswer(invocation -> !copy.isEmpty());
        when(rs.getObject(1)).thenAnswer(invocation -> {
            if (copy.isEmpty()) {
                return null;
            }
            return copy.remove(0);
        });
        return rs;
    }
}
