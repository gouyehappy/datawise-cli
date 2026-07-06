package org.apache.datawise.backend.platform.schedule;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.ai.canvas.AnalysisCanvasService;
import org.apache.datawise.backend.configstore.ScheduledTaskStore;
import org.apache.datawise.backend.database.drift.SchemaDriftService;
import org.apache.datawise.backend.database.sql.SqlReviewService;
import org.apache.datawise.backend.database.sql.SqlService;
import org.apache.datawise.backend.domain.ExecuteSqlRequest;
import org.apache.datawise.backend.domain.ScheduledTaskDto;
import org.apache.datawise.backend.domain.SqlReviewRequest;
import org.apache.datawise.backend.domain.SqlReviewResultDto;
import org.apache.datawise.backend.model.ScheduledTaskEntry;
import org.apache.datawise.backend.service.TeamService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ScheduledTaskServiceTest {

    private ScheduledTaskStore taskStore;
    private SqlService sqlService;
    private SqlReviewService sqlReviewService;
    private TeamService teamService;
    private ScheduledTaskService service;

    @BeforeEach
    void setUp() {
        taskStore = mock(ScheduledTaskStore.class);
        sqlService = mock(SqlService.class);
        sqlReviewService = mock(SqlReviewService.class);
        teamService = mock(TeamService.class);
        service = new ScheduledTaskService(
                taskStore,
                sqlService,
                sqlReviewService,
                mock(SchemaDriftService.class),
                mock(AnalysisCanvasService.class),
                teamService,
                new ObjectMapper()
        );
    }

    @Test
    void runNowBlocksSqlThatRequiresProductionApproval() {
        ScheduledTaskEntry entry = sqlTask("INSERT INTO users(id) VALUES (1)");
        when(taskStore.findById("task-1")).thenReturn(entry);
        when(sqlReviewService.review(any(SqlReviewRequest.class)))
                .thenReturn(new SqlReviewResultDto(true, true, List.of()));

        ScheduledTaskDto result = service.runNow("task-1");

        assertEquals("failed", result.lastRunStatus());
        assertEquals("SQL requires production approval", result.lastRunMessage());
        verifyNoInteractions(sqlService);
        verifyNoInteractions(teamService);
        verify(taskStore).upsert(entry);
    }

    @Test
    void runNowAuditsWriteSqlAfterSuccessfulExecution() {
        String sql = "INSERT INTO users(id) VALUES (1)";
        ScheduledTaskEntry entry = sqlTask(sql);
        when(taskStore.findById("task-1")).thenReturn(entry);
        when(sqlReviewService.review(any(SqlReviewRequest.class)))
                .thenReturn(new SqlReviewResultDto(true, false, List.of()));

        ScheduledTaskDto result = service.runNow("task-1");

        assertEquals("ok", result.lastRunStatus());
        verify(sqlReviewService).review(new SqlReviewRequest(sql, "conn-1", "app"));
        verify(sqlService).execute(any(ExecuteSqlRequest.class));
        verify(teamService).recordSqlExecutionAudit("sql.write", "conn-1", "app", sql);
        verify(taskStore).upsert(entry);
    }

    private static ScheduledTaskEntry sqlTask(String sql) {
        ScheduledTaskEntry entry = new ScheduledTaskEntry();
        entry.setId("task-1");
        entry.setName("Nightly SQL");
        entry.setType(ScheduledTaskEntry.TYPE_SQL);
        entry.setCronExpression("0 0 * * * *");
        entry.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        entry.setPayloadJson("{\"sql\":\"" + sql + "\",\"connectionId\":\"conn-1\",\"database\":\"app\"}");
        return entry;
    }
}