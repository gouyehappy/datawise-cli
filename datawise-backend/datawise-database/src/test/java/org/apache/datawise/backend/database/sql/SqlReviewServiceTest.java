package org.apache.datawise.backend.database.sql;

import org.apache.datawise.backend.domain.SqlReviewRequest;
import org.apache.datawise.backend.domain.SqlReviewResultDto;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.service.ConnectionVisibilityService;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SqlReviewServiceTest {

    @Test
    void blocksDeleteWithoutWhere() {
        ConnectionVisibilityService visibility = mock(ConnectionVisibilityService.class);
        when(visibility.resolveConnectionEntity(anyString())).thenReturn(Optional.empty());
        SqlReviewService service = new SqlReviewService(visibility, mock(SqlService.class));

        SqlReviewResultDto result = service.review(new SqlReviewRequest(
                "DELETE FROM users",
                "conn-1",
                "app"
        ));

        assertFalse(result.allowed());
        assertTrue(result.findings().stream().anyMatch(f -> "MISSING_WHERE".equals(f.code())));
    }

    @Test
    void flagsProductionWriteApproval() {
        ConnectionVisibilityService visibility = mock(ConnectionVisibilityService.class);
        ConnectionEntity prod = new ConnectionEntity();
        prod.setId("conn-prod");
        prod.setEnv("prod");
        when(visibility.resolveConnectionEntity("conn-prod")).thenReturn(Optional.of(prod));
        SqlReviewService service = new SqlReviewService(visibility, mock(SqlService.class));

        SqlReviewResultDto result = service.review(new SqlReviewRequest(
                "UPDATE users SET active = 1 WHERE id = 1",
                "conn-prod",
                "app"
        ));

        assertTrue(result.requiresApproval());
    }

    @Test
    void addsExplainFindingsForMysqlPlanRisks() {
        ConnectionVisibilityService visibility = mock(ConnectionVisibilityService.class);
        ConnectionEntity mysql = new ConnectionEntity();
        mysql.setId("conn-mysql");
        mysql.setDbType("mysql");
        when(visibility.resolveConnectionEntity("conn-mysql")).thenReturn(Optional.of(mysql));

        SqlService sqlService = mock(SqlService.class);
        when(sqlService.execute(org.mockito.ArgumentMatchers.any())).thenReturn(new ExecuteSqlResult(
                "EXPLAIN SELECT * FROM users",
                1,
                1L,
                List.of(),
                List.of(mysqlExplainRow("ALL", null, "Using filesort", 200000L)),
                null,
                null,
                null,
                null,
                null,
                null
        ));

        SqlReviewService service = new SqlReviewService(visibility, sqlService);
        SqlReviewResultDto result = service.review(new SqlReviewRequest(
                "SELECT * FROM users",
                "conn-mysql",
                "app"
        ));

        assertTrue(result.findings().stream().anyMatch(f -> "EXPLAIN_FULL_SCAN".equals(f.code())));
        assertTrue(result.findings().stream().anyMatch(f -> "EXPLAIN_NO_INDEX".equals(f.code())));
        assertTrue(result.findings().stream().anyMatch(f -> "EXPLAIN_HIGH_ROWS".equals(f.code())));
    }

    private static Map<String, Object> mysqlExplainRow(String type, String key, String extra, Long rows) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("type", type);
        row.put("key", key);
        row.put("extra", extra);
        row.put("rows", rows);
        return row;
    }
}
