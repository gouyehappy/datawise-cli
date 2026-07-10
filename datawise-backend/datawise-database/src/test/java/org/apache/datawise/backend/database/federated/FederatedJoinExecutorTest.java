package org.apache.datawise.backend.database.federated;

import org.apache.datawise.backend.database.federated.FederatedJoinSqlParser.FederatedJoinPlan;
import org.apache.datawise.backend.database.federated.FederatedJoinSqlParser.FederatedJoinStep;
import org.apache.datawise.backend.database.sql.SqlService;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.backend.model.FederatedViewSource;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FederatedJoinExecutorTest {

    @Test
    void innerJoinStopsAtMaxRows() {
        SqlService sqlService = mock(SqlService.class);
        when(sqlService.execute(any(), any(), any(), anyInt(), isNull()))
                .thenReturn(result(
                        List.of(row("a", 10), row("a", 20), row("a", 30)),
                        List.of(column("a"))
                ))
                .thenReturn(result(
                        List.of(row("b", 10), row("b", 20), row("b", 30)),
                        List.of(column("b"))
                ));

        FederatedJoinPlan plan = new FederatedJoinPlan(
                List.of("*"),
                List.of(
                        new FederatedJoinStep("left", "left", "select 1", null),
                        new FederatedJoinStep("right", "right", "select 2", "left.a = right.b")
                )
        );
        Map<String, FederatedViewSource> sources = new LinkedHashMap<>();
        sources.put("left", source("left-conn"));
        sources.put("right", source("right-conn"));

        ExecuteSqlResult joined = FederatedJoinExecutor.execute(
                "select * from left join right on left.a = right.b",
                plan,
                sources,
                sqlService,
                2
        );

        assertEquals(2, joined.rowCount());
        assertEquals(2, joined.rows().size());
    }

    private static FederatedViewSource source(String connectionId) {
        FederatedViewSource source = new FederatedViewSource();
        source.setConnectionId(connectionId);
        source.setDatabase("shop");
        return source;
    }

    private static ExecuteSqlResult result(List<Map<String, Object>> rows, List<Map<String, Object>> columns) {
        return new ExecuteSqlResult("sql", rows.size(), 1L, columns, rows, null, null, null, null, null, null);
    }

    private static Map<String, Object> row(String key, Object value) {
        return Map.of(key, value);
    }

    private static Map<String, Object> column(String name) {
        return Map.of("name", name, "key", name);
    }
}
