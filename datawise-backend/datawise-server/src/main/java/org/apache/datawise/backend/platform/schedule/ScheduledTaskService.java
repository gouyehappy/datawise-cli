package org.apache.datawise.backend.platform.schedule;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.ai.canvas.AnalysisCanvasPipelineService;
import org.apache.datawise.backend.ai.canvas.AnalysisCanvasService;
import org.apache.datawise.backend.common.support.IdGenerator;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.apache.datawise.backend.configstore.ScheduledTaskStore;
import org.apache.datawise.backend.database.drift.SchemaDriftService;
import org.apache.datawise.backend.database.sql.SqlReviewService;
import org.apache.datawise.backend.database.sql.SqlService;
import org.apache.datawise.backend.domain.ExecuteSqlRequest;
import org.apache.datawise.backend.domain.PushNotificationRequest;
import org.apache.datawise.backend.domain.RerunAnalysisCanvasRequest;
import org.apache.datawise.backend.domain.SaveScheduledTaskRequest;
import org.apache.datawise.backend.domain.ScheduledTaskDto;
import org.apache.datawise.backend.domain.SqlReviewRequest;
import org.apache.datawise.backend.domain.SqlReviewResultDto;
import org.apache.datawise.backend.configstore.UserScheduledTaskStore.OwnedScheduledTask;
import org.apache.datawise.backend.model.ScheduledTaskEntry;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.service.InstanceWorkspaceService;
import org.apache.datawise.backend.service.TeamService;
import org.apache.datawise.backend.service.workspace.WorkspaceNotificationService;
import org.apache.datawise.backend.connector.api.support.SqlWriteClassifier;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ScheduledTaskService {

    private static final Logger log = LoggerFactory.getLogger(ScheduledTaskService.class);

    private final ScheduledTaskStore taskStore;
    private final SqlService sqlService;
    private final SqlReviewService sqlReviewService;
    private final SchemaDriftService schemaDriftService;
    private final AnalysisCanvasPipelineService analysisCanvasPipelineService;
    private final TeamService teamService;
    private final InstanceWorkspaceService instanceWorkspaceService;
    private final WorkspaceNotificationService notificationService;
    private final ObjectMapper objectMapper;

    public ScheduledTaskService(
            ScheduledTaskStore taskStore,
            SqlService sqlService,
            SqlReviewService sqlReviewService,
            SchemaDriftService schemaDriftService,
            AnalysisCanvasPipelineService analysisCanvasPipelineService,
            TeamService teamService,
            InstanceWorkspaceService instanceWorkspaceService,
            WorkspaceNotificationService notificationService,
            ObjectMapper objectMapper
    ) {
        this.taskStore = taskStore;
        this.sqlService = sqlService;
        this.sqlReviewService = sqlReviewService;
        this.schemaDriftService = schemaDriftService;
        this.analysisCanvasPipelineService = analysisCanvasPipelineService;
        this.teamService = teamService;
        this.instanceWorkspaceService = instanceWorkspaceService;
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
    }

    public List<ScheduledTaskDto> list() {
        return taskStore.listAll().stream()
                .sorted(Comparator.comparing(ScheduledTaskEntry::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toDto)
                .toList();
    }

    public ScheduledTaskDto save(SaveScheduledTaskRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (request.cronExpression() == null || request.cronExpression().isBlank()) {
            throw new IllegalArgumentException("cronExpression is required");
        }
        validateCron(request.cronExpression());

        ScheduledTaskEntry entry = request.id() != null && !request.id().isBlank()
                ? requireEntry(request.id())
                : new ScheduledTaskEntry();
        if (entry.getId() == null) {
            entry.setId(IdGenerator.shortId("task-"));
            entry.setCreatedAt(Instant.now());
        }
        entry.setName(request.name().trim());
        entry.setType(request.type() != null ? request.type().trim() : ScheduledTaskEntry.TYPE_SQL);
        entry.setCronExpression(request.cronExpression().trim());
        entry.setPayloadJson(trimOrNull(request.payloadJson()));
        if (request.enabled() != null) {
            entry.setEnabled(request.enabled());
        }
        taskStore.upsert(entry);
        return toDto(entry);
    }

    public void delete(String id) {
        requireEntry(id);
        taskStore.removeById(id);
    }

    public ScheduledTaskDto runNow(String id) {
        ScheduledTaskEntry entry = requireEntry(id);
        executeTask(entry);
        taskStore.upsert(entry);
        return toDto(entry);
    }

    public void runDueTasks() {
        Instant now = Instant.now();
        for (OwnedScheduledTask owned : taskStore.listAllAcrossUsers()) {
            ScheduledTaskEntry entry = owned.entry();
            if (!entry.isEnabled() || !isDue(entry, now)) {
                continue;
            }
            UserContext.runAs(
                    new UserContext.Snapshot(owned.userId(), false, "scheduled-task:" + entry.getId()),
                    () -> {
                        executeTask(entry);
                        taskStore.upsert(entry);
                    }
            );
        }
    }

    private void executeTask(ScheduledTaskEntry entry) {
        Instant started = Instant.now();
        entry.setLastRunAt(started);
        try {
            String successMessage = switch (entry.getType()) {
                case ScheduledTaskEntry.TYPE_SQL -> runSqlTask(entry);
                case ScheduledTaskEntry.TYPE_CANVAS -> runCanvasTask(entry);
                case ScheduledTaskEntry.TYPE_SCHEMA_DRIFT -> {
                    runSchemaDriftTask(entry);
                    yield "completed";
                }
                default -> throw new IllegalArgumentException("unsupported task type: " + entry.getType());
            };
            entry.setLastRunStatus("ok");
            entry.setLastRunMessage(successMessage);
            pushTaskNotification(entry, true, null);
        } catch (Exception ex) {
            entry.setLastRunStatus("failed");
            String message = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
            entry.setLastRunMessage(message);
            pushTaskNotification(entry, false, message);
        }
    }

    private void pushTaskNotification(ScheduledTaskEntry entry, boolean ok, String errorMessage) {
        try {
            String titleKey = ok ? "scheduledTaskOk" : "scheduledTaskFailed";
            String bodyKey = titleKey;
            String detail = ok
                    ? (entry.getLastRunMessage() != null ? entry.getLastRunMessage() : "")
                    : (errorMessage != null ? errorMessage : "");
            notificationService.pushNotification(new PushNotificationRequest(
                    "workspace",
                    titleKey,
                    bodyKey,
                    Map.of(
                            "name", entry.getName() != null ? entry.getName() : entry.getId(),
                            "type", entry.getType() != null ? entry.getType() : "",
                            "message", detail
                    )
            ));
        } catch (RuntimeException ex) {
            ExceptionLogging.warn(log, "scheduledTask.notification taskId=" + entry.getId(), ex);
        }
    }

    private String runSqlTask(ScheduledTaskEntry entry) throws Exception {
        JsonNode payload = parsePayload(entry.getPayloadJson());
        ScheduledSqlPayloadSupport.ResolvedSql resolved = ScheduledSqlPayloadSupport.resolve(
                payload,
                instanceWorkspaceService,
                teamService
        );
        List<String> statements = ScheduledSqlPayloadSupport.splitExecutableStatements(resolved.sql());
        if (statements.isEmpty()) {
            throw new IllegalArgumentException("SQL is empty");
        }
        int maxRows = payload.has("maxRows") ? payload.get("maxRows").asInt(1000) : 1000;
        int executed = 0;
        for (String statement : statements) {
            SqlReviewResultDto review = sqlReviewService.review(
                    new SqlReviewRequest(statement, resolved.connectionId(), resolved.database())
            );
            if (!review.allowed()) {
                throw new IllegalArgumentException("SQL blocked by review: " + review.findings());
            }
            if (review.requiresApproval()) {
                throw new IllegalArgumentException("SQL requires production approval");
            }
            ExecuteSqlRequest request = new ExecuteSqlRequest(
                    statement,
                    resolved.connectionId(),
                    resolved.database(),
                    maxRows,
                    null,
                    null,
                    null,
                    "scheduled-task"
            );
            sqlService.execute(request);
            recordTeamSqlAudit(request);
            executed += 1;
        }
        return "completed " + executed + " statement(s) via " + resolved.source();
    }

    private void recordTeamSqlAudit(ExecuteSqlRequest request) {
        String sql = request.sql();
        if (sql == null || sql.isBlank() || !SqlWriteClassifier.requiresWriteAccess(sql)) {
            return;
        }
        String action = SqlWriteClassifier.requiresDangerousSqlConfirmation(sql)
                ? "sql.dangerous"
                : "sql.write";
        try {
            teamService.recordSqlExecutionAudit(action, request.connectionId(), request.database(), sql);
        } catch (RuntimeException ex) {
            ExceptionLogging.warn(log, "scheduledTask.sqlAudit connectionId=" + request.connectionId()
                    + " database=" + request.database(), ex);
        }
    }

    private String runCanvasTask(ScheduledTaskEntry entry) throws Exception {
        JsonNode payload = parsePayload(entry.getPayloadJson());
        String canvasId = text(payload, "canvasId");
        Map<String, String> parameterValues = readStringMap(payload.get("parameterValues"));
        AnalysisCanvasPipelineService.PipelineRerunResult result = analysisCanvasPipelineService.rerunPipeline(
                new RerunAnalysisCanvasRequest(canvasId, parameterValues.isEmpty() ? null : parameterValues)
        );
        return result.statusMessage();
    }

    private static Map<String, String> readStringMap(JsonNode node) {
        if (node == null || !node.isObject()) {
            return Map.of();
        }
        Map<String, String> values = new LinkedHashMap<>();
        node.fields().forEachRemaining(field -> {
            if (field.getValue() != null && !field.getValue().isNull()) {
                values.put(field.getKey(), field.getValue().asText(""));
            }
        });
        return values;
    }

    private void runSchemaDriftTask(ScheduledTaskEntry entry) throws Exception {
        JsonNode payload = parsePayload(entry.getPayloadJson());
        String monitorId = text(payload, "monitorId");
        schemaDriftService.runMonitor(monitorId);
    }

    private static boolean isDue(ScheduledTaskEntry entry, Instant now) {
        try {
            CronExpression cron = CronExpression.parse(entry.getCronExpression());
            Instant base = entry.getLastRunAt() != null ? entry.getLastRunAt() : entry.getCreatedAt();
            if (base == null) {
                base = now.minusSeconds(3600);
            }
            Instant next = cron.next(base);
            return next != null && !next.isAfter(now);
        } catch (Exception ex) {
            return false;
        }
    }

    private JsonNode parsePayload(String payloadJson) throws Exception {
        if (payloadJson == null || payloadJson.isBlank()) {
            throw new IllegalArgumentException("payloadJson is required");
        }
        return objectMapper.readTree(payloadJson);
    }

    private static String text(JsonNode node, String field) {
        if (!node.has(field) || node.get(field).isNull()) {
            throw new IllegalArgumentException(field + " is required in payload");
        }
        String value = node.get(field).asText("").trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException(field + " is required in payload");
        }
        return value;
    }

    private ScheduledTaskEntry requireEntry(String id) {
        ScheduledTaskEntry entry = taskStore.findById(id);
        if (entry == null) {
            throw new IllegalArgumentException("task not found: " + id);
        }
        return entry;
    }

    private static void validateCron(String cron) {
        try {
            CronExpression.parse(cron);
        } catch (Exception ex) {
            throw new IllegalArgumentException("invalid cron expression: " + cron);
        }
    }

    private ScheduledTaskDto toDto(ScheduledTaskEntry entry) {
        return new ScheduledTaskDto(
                entry.getId(),
                entry.getName(),
                entry.getType(),
                entry.getCronExpression(),
                entry.getPayloadJson(),
                entry.isEnabled(),
                entry.getLastRunAt(),
                entry.getLastRunStatus(),
                entry.getLastRunMessage(),
                entry.getCreatedAt()
        );
    }

    private static String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

@Component
@EnableScheduling
class ScheduledTaskRunner {

    private final ScheduledTaskService scheduledTaskService;

    ScheduledTaskRunner(ScheduledTaskService scheduledTaskService) {
        this.scheduledTaskService = scheduledTaskService;
    }

    @Scheduled(fixedDelayString = "${datawise.platform.scheduled-tasks.poll-ms:60000}")
    void pollDueTasks() {
        scheduledTaskService.runDueTasks();
    }
}
