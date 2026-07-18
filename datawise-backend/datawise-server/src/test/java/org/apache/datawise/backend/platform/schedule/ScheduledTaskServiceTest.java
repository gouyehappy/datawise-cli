package org.apache.datawise.backend.platform.schedule;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.ai.canvas.AnalysisCanvasPipelineService;
import org.apache.datawise.backend.configstore.ScheduledTaskStore;
import org.apache.datawise.backend.database.drift.SchemaDriftService;
import org.apache.datawise.backend.database.sql.SqlReviewService;
import org.apache.datawise.backend.database.sql.SqlService;
import org.apache.datawise.backend.domain.DataQualityGateRequest;
import org.apache.datawise.backend.domain.DataQualityGateResultDto;
import org.apache.datawise.backend.domain.ExecuteSqlRequest;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.backend.domain.RerunAnalysisCanvasRequest;
import org.apache.datawise.backend.domain.SaveScheduledTaskRequest;
import org.apache.datawise.backend.domain.ScheduledTaskDto;
import org.apache.datawise.backend.domain.SqlReviewRequest;
import org.apache.datawise.backend.domain.SqlReviewResultDto;
import org.apache.datawise.backend.model.ScheduledTaskEntry;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.service.InstanceWorkspaceService;
import org.apache.datawise.backend.service.TeamService;
import org.apache.datawise.backend.service.outbound.OutboundNotifySupport;
import org.apache.datawise.backend.service.workspace.WorkspaceNotificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ScheduledTaskServiceTest {

    private ScheduledTaskStore taskStore;
    private SqlService sqlService;
    private SqlReviewService sqlReviewService;
    private TeamService teamService;
    private InstanceWorkspaceService instanceWorkspaceService;
    private AnalysisCanvasPipelineService analysisCanvasPipelineService;
    private OutboundNotifySupport outboundNotifySupport;
    private ScheduledTaskService service;

    @BeforeEach
    void setUp() {
        taskStore = mock(ScheduledTaskStore.class);
        sqlService = mock(SqlService.class);
        sqlReviewService = mock(SqlReviewService.class);
        teamService = mock(TeamService.class);
        instanceWorkspaceService = mock(InstanceWorkspaceService.class);
        analysisCanvasPipelineService = mock(AnalysisCanvasPipelineService.class);
        outboundNotifySupport = mock(OutboundNotifySupport.class);
        service = new ScheduledTaskService(
                taskStore,
                sqlService,
                sqlReviewService,
                mock(SchemaDriftService.class),
                analysisCanvasPipelineService,
                teamService,
                instanceWorkspaceService,
                mock(WorkspaceNotificationService.class),
                outboundNotifySupport,
                new ObjectMapper()
        );
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
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
        assertTrue(result.lastRunMessage().contains("1 statement"));
        verify(sqlReviewService).review(new SqlReviewRequest(sql, "conn-1", "app"));
        verify(sqlService).execute(any(ExecuteSqlRequest.class));
        verify(teamService).recordSqlExecutionAudit("sql.write", "conn-1", "app", sql);
        verify(taskStore).upsert(entry);
    }

    @Test
    void runNowLoadsWorkspaceSqlFileAndExecutesBatch() throws Exception {
        ScheduledTaskEntry entry = new ScheduledTaskEntry();
        entry.setId("task-file");
        entry.setName("Nightly file");
        entry.setType(ScheduledTaskEntry.TYPE_SQL);
        entry.setCronExpression("0 0 * * * *");
        entry.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        entry.setPayloadJson(
                "{\"source\":\"workspace_file\",\"connectionId\":\"conn-1\",\"database\":\"app\",\"sqlFile\":\"job.sql\"}"
        );
        when(taskStore.findById("task-file")).thenReturn(entry);
        when(instanceWorkspaceService.readSql("conn-1", "app", "job.sql"))
                .thenReturn("SELECT 1; SELECT 2;");
        when(sqlReviewService.review(any(SqlReviewRequest.class)))
                .thenReturn(new SqlReviewResultDto(true, false, List.of()));

        ScheduledTaskDto result = service.runNow("task-file");

        assertEquals("ok", result.lastRunStatus());
        assertTrue(result.lastRunMessage().contains("2 statement"));
        assertTrue(result.lastRunMessage().contains("workspace_file"));
        verify(sqlService, times(2)).execute(any(ExecuteSqlRequest.class));
        verify(instanceWorkspaceService).readSql(eq("conn-1"), eq("app"), eq("job.sql"));
    }

    @Test
    void runNowExecutesCanvasPipelineAndStoresSummary() {
        ScheduledTaskEntry entry = canvasTask("canvas-1");
        when(taskStore.findById("task-canvas")).thenReturn(entry);
        when(analysisCanvasPipelineService.rerunPipeline(any(RerunAnalysisCanvasRequest.class)))
                .thenReturn(new AnalysisCanvasPipelineService.PipelineRerunResult(
                        "canvas-1",
                        "Weekly GMV",
                        "Revenue increased",
                        "SELECT 1",
                        "analysis",
                        12
                ));

        ScheduledTaskDto result = service.runNow("task-canvas");

        assertEquals("ok", result.lastRunStatus());
        assertEquals("Weekly GMV · 12 rows · Revenue increased", result.lastRunMessage());
        verify(analysisCanvasPipelineService).rerunPipeline(new RerunAnalysisCanvasRequest("canvas-1", null));
        verify(taskStore).upsert(entry);
    }

    @Test
    void runNowPublishesInsightDigestWhenEnabled() {
        UserContext.set(9L, false, "session-1", "default");
        ScheduledTaskEntry entry = sqlTask("SELECT id FROM users");
        entry.setPayloadJson(
                "{\"sql\":\"SELECT id FROM users\",\"connectionId\":\"conn-1\",\"database\":\"app\",\"digest\":true,\"digestMaxRows\":1}"
        );
        when(taskStore.findById("task-1")).thenReturn(entry);
        when(sqlReviewService.review(any(SqlReviewRequest.class)))
                .thenReturn(new SqlReviewResultDto(true, false, List.of()));
        when(sqlService.execute(any(ExecuteSqlRequest.class))).thenReturn(new ExecuteSqlResult(
                "SELECT id FROM users",
                2,
                5L,
                List.of(Map.of("name", "id")),
                List.of(Map.of("id", 1), Map.of("id", 2)),
                null,
                null,
                null,
                false,
                null,
                null
        ));

        ScheduledTaskDto result = service.runNow("task-1");

        assertEquals("ok", result.lastRunStatus());
        verify(outboundNotifySupport).insightDigest(
                eq("Nightly SQL"),
                eq(ScheduledTaskEntry.TYPE_SQL),
                any(),
                eq(Map.of(
                        "rowCount", 2,
                        "columns", List.of("id"),
                        "rows", List.of(Map.of("id", 1)),
                        "truncated", true
                )),
                eq(9L)
        );
    }

    @Test
    void runNowSkipsInsightDigestWhenDisabled() {
        UserContext.set(9L, false, "session-1", "default");
        ScheduledTaskEntry entry = sqlTask("SELECT 1");
        when(taskStore.findById("task-1")).thenReturn(entry);
        when(sqlReviewService.review(any(SqlReviewRequest.class)))
                .thenReturn(new SqlReviewResultDto(true, false, List.of()));
        when(sqlService.execute(any(ExecuteSqlRequest.class))).thenReturn(new ExecuteSqlResult(
                "SELECT 1",
                1,
                1L,
                List.of(Map.of("name", "c")),
                List.of(Map.of("c", 1)),
                null,
                null,
                null,
                false,
                null,
                null
        ));

        service.runNow("task-1");

        verify(outboundNotifySupport).scheduledTask(eq(true), eq("Nightly SQL"), eq("sql"), any(), eq(9L));
        verify(outboundNotifySupport, times(0)).insightDigest(any(), any(), any(), any(), any());
    }

    @Test
    void saveDataQualityAllowsBlankCronForGateOnly() {
        when(taskStore.upsert(any(ScheduledTaskEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        ScheduledTaskDto saved = service.save(new SaveScheduledTaskRequest(
                null,
                "Gate only",
                ScheduledTaskEntry.TYPE_DATA_QUALITY,
                "",
                "{\"connectionId\":\"c1\",\"database\":\"db\",\"sql\":\"SELECT 1 WHERE 1=0\",\"assertion\":\"empty_result\",\"blocking\":true}",
                true
        ));

        assertNull(saved.cronExpression());
        assertEquals(ScheduledTaskEntry.TYPE_DATA_QUALITY, saved.type());
    }

    @Test
    void evaluateDataQualityGateFailsWhenBlockingRuleFails() {
        ScheduledTaskEntry blocking = new ScheduledTaskEntry();
        blocking.setId("dq-block");
        blocking.setName("No negatives");
        blocking.setType(ScheduledTaskEntry.TYPE_DATA_QUALITY);
        blocking.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        blocking.setPayloadJson(
                "{\"connectionId\":\"conn-1\",\"database\":\"app\",\"sql\":\"SELECT id FROM orders WHERE amount < 0\","
                        + "\"assertion\":\"empty_result\",\"blocking\":true}"
        );
        ScheduledTaskEntry nonBlocking = new ScheduledTaskEntry();
        nonBlocking.setId("dq-soft");
        nonBlocking.setName("Soft check");
        nonBlocking.setType(ScheduledTaskEntry.TYPE_DATA_QUALITY);
        nonBlocking.setCreatedAt(Instant.parse("2026-01-02T00:00:00Z"));
        nonBlocking.setPayloadJson(
                "{\"connectionId\":\"conn-1\",\"database\":\"app\",\"sql\":\"SELECT 1 WHERE 1=0\","
                        + "\"assertion\":\"empty_result\",\"blocking\":false}"
        );
        when(taskStore.listAll()).thenReturn(List.of(blocking, nonBlocking));
        when(taskStore.findById("dq-block")).thenReturn(blocking);
        when(sqlReviewService.review(any(SqlReviewRequest.class)))
                .thenReturn(new SqlReviewResultDto(true, false, List.of()));
        when(sqlService.execute(any(ExecuteSqlRequest.class))).thenReturn(new ExecuteSqlResult(
                "SELECT id FROM orders WHERE amount < 0",
                1,
                3L,
                List.of(Map.of("name", "id")),
                List.of(Map.of("id", 9)),
                null,
                null,
                null,
                false,
                null,
                null
        ));

        DataQualityGateResultDto gate = service.evaluateDataQualityGate(
                new DataQualityGateRequest(null, "conn-1", "app", true, null, null)
        );

        assertFalse(gate.passed());
        assertEquals(1, gate.total());
        assertEquals(1, gate.failed());
        assertEquals("dq-block", gate.results().get(0).ruleId());
        assertTrue(gate.results().get(0).blocking());
        assertNull(gate.scopes());
    }

    @Test
    void evaluateDataQualityGateMultiEnvRequiresBothScopes() {
        ScheduledTaskEntry primary = new ScheduledTaskEntry();
        primary.setId("dq-prod");
        primary.setName("Prod check");
        primary.setType(ScheduledTaskEntry.TYPE_DATA_QUALITY);
        primary.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        primary.setPayloadJson(
                "{\"connectionId\":\"conn-prod\",\"database\":\"app\",\"sql\":\"SELECT 1 WHERE 1=0\","
                        + "\"assertion\":\"empty_result\",\"blocking\":true}"
        );
        ScheduledTaskEntry staging = new ScheduledTaskEntry();
        staging.setId("dq-stg");
        staging.setName("Staging check");
        staging.setType(ScheduledTaskEntry.TYPE_DATA_QUALITY);
        staging.setCreatedAt(Instant.parse("2026-01-02T00:00:00Z"));
        staging.setPayloadJson(
                "{\"connectionId\":\"conn-stg\",\"database\":\"app\",\"sql\":\"SELECT id FROM t WHERE bad=1\","
                        + "\"assertion\":\"empty_result\",\"blocking\":true}"
        );
        when(taskStore.listAll()).thenReturn(List.of(primary, staging));
        when(taskStore.findById("dq-prod")).thenReturn(primary);
        when(taskStore.findById("dq-stg")).thenReturn(staging);
        when(sqlReviewService.review(any(SqlReviewRequest.class)))
                .thenReturn(new SqlReviewResultDto(true, false, List.of()));
        when(sqlService.execute(any(ExecuteSqlRequest.class))).thenAnswer(invocation -> {
            ExecuteSqlRequest req = invocation.getArgument(0);
            boolean fail = req.sql() != null && req.sql().contains("bad=1");
            return new ExecuteSqlResult(
                    req.sql(),
                    fail ? 1 : 0,
                    3L,
                    List.of(Map.of("name", "id")),
                    fail ? List.of(Map.of("id", 1)) : List.of(),
                    null,
                    null,
                    null,
                    false,
                    null,
                    null
            );
        });

        DataQualityGateResultDto gate = service.evaluateDataQualityGate(
                new DataQualityGateRequest(null, "conn-prod", "app", true, "conn-stg", "app")
        );

        assertFalse(gate.passed());
        assertEquals(2, gate.total());
        assertEquals(1, gate.failed());
        assertEquals(2, gate.scopes().size());
        assertTrue(gate.scopes().get(0).passed());
        assertEquals("conn-prod", gate.scopes().get(0).connectionId());
        assertFalse(gate.scopes().get(1).passed());
        assertEquals("conn-stg", gate.scopes().get(1).connectionId());
    }

    @Test
    void runNowDataQualityFailsWhenAssertionFails() {
        ScheduledTaskEntry entry = new ScheduledTaskEntry();
        entry.setId("task-dq");
        entry.setName("Negative amounts");
        entry.setType(ScheduledTaskEntry.TYPE_DATA_QUALITY);
        entry.setCronExpression("0 0 * * * *");
        entry.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        entry.setPayloadJson(
                "{\"connectionId\":\"conn-1\",\"database\":\"app\",\"sql\":\"SELECT id FROM orders WHERE amount < 0\","
                        + "\"assertion\":\"empty_result\",\"expected\":\"0\"}"
        );
        when(taskStore.findById("task-dq")).thenReturn(entry);
        when(sqlReviewService.review(any(SqlReviewRequest.class)))
                .thenReturn(new SqlReviewResultDto(true, false, List.of()));
        when(sqlService.execute(any(ExecuteSqlRequest.class))).thenReturn(new ExecuteSqlResult(
                "SELECT id FROM orders WHERE amount < 0",
                1,
                3L,
                List.of(Map.of("name", "id")),
                List.of(Map.of("id", 9)),
                null,
                null,
                null,
                false,
                null,
                null
        ));

        ScheduledTaskDto result = service.runNow("task-dq");

        assertEquals("failed", result.lastRunStatus());
        assertTrue(result.lastRunMessage().contains("DQ_ASSERTION_FAILED"));
        verify(outboundNotifySupport).dataQuality(eq(false), eq("Negative amounts"), any(), any(), any());
        verifyNoInteractions(analysisCanvasPipelineService);
    }

    @Test
    void runNowHttpTriggerFailsOnNon2xx() throws Exception {
        com.sun.net.httpserver.HttpServer server =
                com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/fail", exchange -> {
            byte[] body = "boom".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(503, body.length);
            try (java.io.OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        server.start();
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/fail";
            ScheduledTaskEntry entry = new ScheduledTaskEntry();
            entry.setId("task-http");
            entry.setName("Trigger DAG");
            entry.setType(ScheduledTaskEntry.TYPE_HTTP_TRIGGER);
            entry.setCronExpression("0 0 * * * *");
            entry.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
            entry.setPayloadJson("{\"url\":\"" + url + "\",\"method\":\"POST\",\"bodyJson\":{}}");
            when(taskStore.findById("task-http")).thenReturn(entry);

            ScheduledTaskDto result = service.runNow("task-http");

            assertEquals("failed", result.lastRunStatus());
            assertTrue(result.lastRunMessage().contains("HTTP 503"));
            verify(outboundNotifySupport).orchestration(eq(false), eq("Trigger DAG"), any(), any(), any());
        } finally {
            server.stop(0);
        }
    }

    private static ScheduledTaskEntry canvasTask(String canvasId) {
        ScheduledTaskEntry entry = new ScheduledTaskEntry();
        entry.setId("task-canvas");
        entry.setName("Weekly analysis");
        entry.setType(ScheduledTaskEntry.TYPE_CANVAS);
        entry.setCronExpression("0 0 * * MON");
        entry.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        entry.setPayloadJson("{\"canvasId\":\"" + canvasId + "\"}");
        return entry;
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