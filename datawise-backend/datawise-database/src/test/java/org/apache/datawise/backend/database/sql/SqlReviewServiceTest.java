package org.apache.datawise.backend.database.sql;

import org.apache.datawise.backend.domain.SqlReviewRequest;
import org.apache.datawise.backend.domain.SqlReviewResultDto;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.service.ConnectionVisibilityService;
import org.junit.jupiter.api.Test;

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
        SqlReviewService service = new SqlReviewService(visibility);

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
        SqlReviewService service = new SqlReviewService(visibility);

        SqlReviewResultDto result = service.review(new SqlReviewRequest(
                "UPDATE users SET active = 1 WHERE id = 1",
                "conn-prod",
                "app"
        ));

        assertTrue(result.requiresApproval());
    }
}
