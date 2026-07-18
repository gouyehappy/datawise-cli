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
import org.apache.datawise.backend.domain.DataQualityGateRequest;
import org.apache.datawise.backend.domain.DataQualityGateResultDto;
import org.apache.datawise.backend.domain.DataQualityGateScopeResultDto;
import org.apache.datawise.backend.domain.DataQualityRuleRunDto;
import org.apache.datawise.backend.domain.ExecuteSqlRequest;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.backend.domain.OrchestrationStatusDto;
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
import org.apache.datawise.backend.service.outbound.OutboundNotifySupport;
import org.apache.datawise.backend.service.workspace.WorkspaceNotificationService;
import org.apache.datawise.backend.connector.api.support.SqlWriteClassifier;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class ScheduledTaskService {

    private static final Logger log = LoggerFactory.getLogger(ScheduledTaskService.class);

    private static final int DEFAULT_DIGEST_MAX_ROWS = 20;
    private static final int HARD_DIGEST_MAX_ROWS = 50;

    private final ScheduledTaskStore taskStore;
    private final SqlService sqlService;
    private final SqlReviewService sqlReviewService;
    private final SchemaDriftService schemaDriftService;
    private final AnalysisCanvasPipelineService analysisCanvasPipelineService;
    private final TeamService teamService;
    private final InstanceWorkspaceService instanceWorkspaceService;
    private final WorkspaceNotificationService notificationService;
    private final OutboundNotifySupport outboundNotifySupport;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public ScheduledTaskService(
            ScheduledTaskStore taskStore,
            SqlService sqlService,
            SqlReviewService sqlReviewService,
            SchemaDriftService schemaDriftService,
            AnalysisCanvasPipelineService analysisCanvasPipelineService,
            TeamService teamService,
            InstanceWorkspaceService instanceWorkspaceService,
            WorkspaceNotificationService notificationService,
            OutboundNotifySupport outboundNotifySupport,
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
        this.outboundNotifySupport = outboundNotifySupport;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
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
        String type = request.type() != null ? request.type().trim() : ScheduledTaskEntry.TYPE_SQL;
        String cron = request.cronExpression() != null ? request.cronExpression().trim() : "";
        boolean gateOnlyDq = ScheduledTaskEntry.TYPE_DATA_QUALITY.equals(type) && cron.isEmpty();
        if (!gateOnlyDq) {
            if (cron.isEmpty()) {
                throw new IllegalArgumentException("cronExpression is required");
            }
            validateCron(cron);
        }

        ScheduledTaskEntry entry = request.id() != null && !request.id().isBlank()
                ? requireEntry(request.id())
                : new ScheduledTaskEntry();
        if (entry.getId() == null) {
            entry.setId(IdGenerator.shortId("task-"));
            entry.setCreatedAt(Instant.now());
        }
        entry.setName(request.name().trim());
        entry.setType(type);
        entry.setCronExpression(gateOnlyDq ? null : cron);
        entry.setPayloadJson(trimOrNull(request.payloadJson()));
        if (request.enabled() != null) {
            entry.setEnabled(request.enabled());
        }
        taskStore.upsert(entry);
        return toDto(entry);
    }

    /** Catalog view: {@code data_quality} tasks, optionally scoped by connection/database in payload. */
    public List<ScheduledTaskDto> listDataQualityRules(String connectionId, String database) {
        return taskStore.listAll().stream()
                .filter(entry -> ScheduledTaskEntry.TYPE_DATA_QUALITY.equals(entry.getType()))
                .filter(entry -> matchesDqScope(entry, connectionId, database))
                .sorted(Comparator.comparing(ScheduledTaskEntry::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toDto)
                .toList();
    }

    /**
     * Release gate: run matching DQ rules and return aggregate pass/fail.
     * Each rule still updates last-run status and emits outbound webhooks.
     * <p>
     * When {@code referenceConnectionId} is set, also evaluates a blocking-only suite
     * on that scope (rule IDs apply only to the primary scope). Aggregate {@code passed}
     * requires both scopes to pass; {@code scopes} carries the per-env breakdown.
     */
    public DataQualityGateResultDto evaluateDataQualityGate(DataQualityGateRequest request) {
        DataQualityGateRequest req = request != null
                ? request
                : new DataQualityGateRequest(null, null, null, null, null, null);
        boolean blockingOnly = req.blockingOnly() == null || Boolean.TRUE.equals(req.blockingOnly());

        DataQualityGateScopeResultDto primary = evaluateDataQualityScope(
                req.connectionId(),
                req.database(),
                req.ruleIds(),
                blockingOnly
        );

        String referenceConnectionId = blankToNull(req.referenceConnectionId());
        if (referenceConnectionId == null) {
            return new DataQualityGateResultDto(
                    primary.passed(),
                    primary.total(),
                    primary.failed(),
                    primary.results(),
                    null
            );
        }

        String primaryConnectionId = blankToNull(req.connectionId());
        String primaryDatabase = blankToNull(req.database());
        String referenceDatabase = blankToNull(req.referenceDatabase());
        if (referenceDatabase == null) {
            referenceDatabase = primaryDatabase;
        }
        if (referenceConnectionId.equals(primaryConnectionId)
                && java.util.Objects.equals(nullToEmpty(referenceDatabase), nullToEmpty(primaryDatabase))) {
            throw new IllegalArgumentException("reference scope must differ from primary connection/database");
        }

        // Reference env always uses its own blocking suite (rule IDs are primary-scoped).
        DataQualityGateScopeResultDto reference = evaluateDataQualityScope(
                referenceConnectionId,
                referenceDatabase,
                null,
                true
        );

        int total = primary.total() + reference.total();
        int failed = primary.failed() + reference.failed();
        boolean passed = primary.passed() && reference.passed();
        return new DataQualityGateResultDto(
                passed,
                total,
                failed,
                primary.results(),
                List.of(primary, reference)
        );
    }

    private DataQualityGateScopeResultDto evaluateDataQualityScope(
            String connectionId,
            String database,
            List<String> ruleIds,
            boolean blockingOnly
    ) {
        Set<String> ids = new HashSet<>();
        if (ruleIds != null) {
            for (String id : ruleIds) {
                if (id != null && !id.isBlank()) {
                    ids.add(id.trim());
                }
            }
        }
        List<ScheduledTaskEntry> rules = taskStore.listAll().stream()
                .filter(entry -> ScheduledTaskEntry.TYPE_DATA_QUALITY.equals(entry.getType()))
                .filter(entry -> matchesDqScope(entry, connectionId, database))
                .filter(entry -> {
                    if (!ids.isEmpty()) {
                        return ids.contains(entry.getId());
                    }
                    return !blockingOnly || isBlockingRule(entry);
                })
                .sorted(Comparator.comparing(ScheduledTaskEntry::getName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();

        List<DataQualityRuleRunDto> results = new ArrayList<>();
        int failed = 0;
        for (ScheduledTaskEntry entry : rules) {
            executeTask(entry);
            taskStore.upsert(entry);
            boolean ok = "ok".equalsIgnoreCase(entry.getLastRunStatus());
            if (!ok) {
                failed++;
            }
            results.add(new DataQualityRuleRunDto(
                    entry.getId(),
                    entry.getName(),
                    isBlockingRule(entry),
                    entry.getLastRunStatus(),
                    entry.getLastRunMessage(),
                    entry.getLastRunAt()
            ));
        }
        return new DataQualityGateScopeResultDto(
                blankToNull(connectionId),
                blankToNull(database),
                failed == 0,
                results.size(),
                failed,
                results
        );
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
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

    /**
     * Poll remote DAG/job status for an {@code http_trigger} task using {@code statusUrl}
     * or {@code statusUrlTemplate} from the payload (same auth headers as the trigger).
     */
    public OrchestrationStatusDto pollOrchestrationStatus(String taskId) {
        if (taskId == null || taskId.isBlank()) {
            throw new IllegalArgumentException("taskId is required");
        }
        ScheduledTaskEntry entry = requireEntry(taskId.trim());
        if (!ScheduledTaskEntry.TYPE_HTTP_TRIGGER.equals(entry.getType())) {
            throw new IllegalArgumentException("task is not http_trigger: " + entry.getType());
        }
        try {
            JsonNode payload = parsePayload(entry.getPayloadJson());
            OrchestrationHttpSupport.Result result = OrchestrationHttpSupport.fetchStatus(
                    payload,
                    entry.getOrchestrationRef(),
                    objectMapper,
                    httpClient
            );
            String ref = OrchestrationHttpSupport.extractRef(result.body(), objectMapper);
            if (ref != null && !ref.isBlank()) {
                entry.setOrchestrationRef(ref);
            }
            String state = OrchestrationHttpSupport.extractState(result.body(), objectMapper, payload);
            Instant checked = Instant.now();
            entry.setOrchestrationState(state != null ? state : "unknown");
            entry.setOrchestrationCheckedAt(checked);
            entry.setOrchestrationDetail(result.bodyPreview());
            taskStore.upsert(entry);
            return new OrchestrationStatusDto(
                    entry.getId(),
                    entry.getName(),
                    entry.getOrchestrationState(),
                    entry.getOrchestrationRef(),
                    entry.getOrchestrationDetail(),
                    result.url(),
                    result.statusCode(),
                    checked
            );
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException(
                    ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName(),
                    ex
            );
        }
    }

    public void runDueTasks() {
        Instant now = Instant.now();
        for (OwnedScheduledTask owned : taskStore.listAllAcrossUsers()) {
            ScheduledTaskEntry entry = owned.entry();
            if (!entry.isEnabled() || !isDue(entry, now)) {
                continue;
            }
            UserContext.runAs(
                    new UserContext.Snapshot(
                            owned.userId(),
                            false,
                            "scheduled-task:" + entry.getId(),
                            null,
                            owned.tenantId()
                    ),
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
            TaskRunOutcome outcome = switch (entry.getType()) {
                case ScheduledTaskEntry.TYPE_SQL -> runSqlTask(entry);
                case ScheduledTaskEntry.TYPE_CANVAS -> runCanvasTask(entry);
                case ScheduledTaskEntry.TYPE_SCHEMA_DRIFT -> {
                    runSchemaDriftTask(entry);
                    yield TaskRunOutcome.messageOnly("completed");
                }
                case ScheduledTaskEntry.TYPE_DATA_QUALITY -> runDataQualityTask(entry);
                case ScheduledTaskEntry.TYPE_HTTP_TRIGGER -> runHttpTriggerTask(entry);
                default -> throw new IllegalArgumentException("unsupported task type: " + entry.getType());
            };
            entry.setLastRunStatus("ok");
            entry.setLastRunMessage(outcome.message());
            pushTaskNotification(entry, true, null, outcome.digest());
        } catch (Exception ex) {
            entry.setLastRunStatus("failed");
            String message = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
            entry.setLastRunMessage(message);
            pushTaskNotification(entry, false, message, null);
        }
    }

    private void pushTaskNotification(
            ScheduledTaskEntry entry,
            boolean ok,
            String errorMessage,
            Map<String, Object> digest
    ) {
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
            outboundNotifySupport.scheduledTask(
                    ok,
                    entry.getName() != null ? entry.getName() : entry.getId(),
                    entry.getType(),
                    detail,
                    UserContext.getUserId()
            );
            if (ScheduledTaskEntry.TYPE_DATA_QUALITY.equals(entry.getType())) {
                outboundNotifySupport.dataQuality(
                        ok,
                        entry.getName() != null ? entry.getName() : entry.getId(),
                        detail,
                        digest,
                        UserContext.getUserId()
                );
            }
            if (ScheduledTaskEntry.TYPE_HTTP_TRIGGER.equals(entry.getType())) {
                outboundNotifySupport.orchestration(
                        ok,
                        entry.getName() != null ? entry.getName() : entry.getId(),
                        detail,
                        digest,
                        UserContext.getUserId()
                );
            }
            if (ok && digest != null && !digest.isEmpty()
                    && !ScheduledTaskEntry.TYPE_DATA_QUALITY.equals(entry.getType())
                    && !ScheduledTaskEntry.TYPE_HTTP_TRIGGER.equals(entry.getType())) {
                outboundNotifySupport.insightDigest(
                        entry.getName() != null ? entry.getName() : entry.getId(),
                        entry.getType(),
                        detail,
                        digest,
                        UserContext.getUserId()
                );
            }
        } catch (RuntimeException ex) {
            ExceptionLogging.warn(log, "scheduledTask.notification taskId=" + entry.getId(), ex);
        }
    }

    private TaskRunOutcome runSqlTask(ScheduledTaskEntry entry) throws Exception {
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
        boolean digest = payload.path("digest").asBoolean(false);
        int digestMaxRows = resolveDigestMaxRows(payload);
        int executed = 0;
        ExecuteSqlResult lastResult = null;
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
            lastResult = sqlService.execute(request);
            recordTeamSqlAudit(request);
            executed += 1;
        }
        String message = "completed " + executed + " statement(s) via " + resolved.source();
        if (!digest || lastResult == null) {
            return TaskRunOutcome.messageOnly(message);
        }
        return new TaskRunOutcome(message, buildSqlDigest(lastResult, digestMaxRows));
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

    private TaskRunOutcome runCanvasTask(ScheduledTaskEntry entry) throws Exception {
        JsonNode payload = parsePayload(entry.getPayloadJson());
        String canvasId = text(payload, "canvasId");
        Map<String, String> parameterValues = readStringMap(payload.get("parameterValues"));
        boolean digest = payload.path("digest").asBoolean(false);
        AnalysisCanvasPipelineService.PipelineRerunResult result = analysisCanvasPipelineService.rerunPipeline(
                new RerunAnalysisCanvasRequest(canvasId, parameterValues.isEmpty() ? null : parameterValues)
        );
        String message = result.statusMessage();
        if (!digest) {
            return TaskRunOutcome.messageOnly(message);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("canvasId", result.canvasId() != null ? result.canvasId() : canvasId);
        data.put("title", result.title() != null ? result.title() : "");
        data.put("rowCount", result.rowCount());
        data.put("summary", clip(result.summary(), 500));
        if (result.sql() != null && !result.sql().isBlank()) {
            data.put("sql", result.sql());
        }
        return new TaskRunOutcome(message, data);
    }

    private static Map<String, Object> buildSqlDigest(ExecuteSqlResult result, int digestMaxRows) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("rowCount", result.rowCount());
        List<String> columnNames = new ArrayList<>();
        if (result.columns() != null) {
            for (Map<String, Object> column : result.columns()) {
                if (column == null) {
                    continue;
                }
                Object name = column.get("name");
                if (name == null) {
                    name = column.get("key");
                }
                if (name != null && !name.toString().isBlank()) {
                    columnNames.add(name.toString());
                }
            }
        }
        data.put("columns", columnNames);
        List<Map<String, Object>> rows = result.rows() != null ? result.rows() : List.of();
        int limit = Math.min(digestMaxRows, rows.size());
        data.put("rows", rows.subList(0, limit));
        data.put("truncated", rows.size() > limit || Boolean.TRUE.equals(result.hasMore()));
        return data;
    }

    private static int resolveDigestMaxRows(JsonNode payload) {
        int value = payload.has("digestMaxRows") ? payload.get("digestMaxRows").asInt(DEFAULT_DIGEST_MAX_ROWS) : DEFAULT_DIGEST_MAX_ROWS;
        if (value < 1) {
            return 1;
        }
        return Math.min(HARD_DIGEST_MAX_ROWS, value);
    }

    private static String clip(String value, int maxChars) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= maxChars) {
            return trimmed;
        }
        return trimmed.substring(0, Math.max(0, maxChars - 3)) + "...";
    }

    private record TaskRunOutcome(String message, Map<String, Object> digest) {
        static TaskRunOutcome messageOnly(String message) {
            return new TaskRunOutcome(message, null);
        }
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

    private TaskRunOutcome runDataQualityTask(ScheduledTaskEntry entry) throws Exception {
        JsonNode payload = parsePayload(entry.getPayloadJson());
        String connectionId = text(payload, "connectionId");
        String database = text(payload, "database");
        String sql = text(payload, "sql");
        if (SqlWriteClassifier.requiresWriteAccess(sql)) {
            throw new IllegalArgumentException("DQ rules must be read-only SELECT statements");
        }
        String assertion = payload.has("assertion") && !payload.get("assertion").isNull()
                ? payload.get("assertion").asText("empty_result").trim()
                : DataQualityAssertionSupport.EMPTY_RESULT;
        String expected = payload.has("expected") && !payload.get("expected").isNull()
                ? payload.get("expected").asText("")
                : "0";
        String column = payload.has("column") && !payload.get("column").isNull()
                ? payload.get("column").asText(null)
                : null;
        int maxRows = payload.has("maxRows") ? payload.get("maxRows").asInt(1000) : 1000;

        SqlReviewResultDto review = sqlReviewService.review(new SqlReviewRequest(sql, connectionId, database));
        if (!review.allowed()) {
            throw new IllegalArgumentException("SQL blocked by review: " + review.findings());
        }
        if (review.requiresApproval()) {
            throw new IllegalArgumentException("SQL requires production approval");
        }

        ExecuteSqlRequest request = new ExecuteSqlRequest(
                sql,
                connectionId,
                database,
                maxRows,
                null,
                null,
                null,
                "data-quality"
        );
        ExecuteSqlResult result = sqlService.execute(request);
        DataQualityAssertionSupport.evaluate(result, assertion, expected, column);

        Map<String, Object> digest = new LinkedHashMap<>();
        digest.put("assertion", assertion);
        digest.put("expected", expected);
        digest.put("rowCount", result.rowCount());
        if (column != null && !column.isBlank()) {
            digest.put("column", column);
        }
        return new TaskRunOutcome(
                "DQ ok: " + assertion + " (rowCount=" + result.rowCount() + ")",
                digest
        );
    }

    private TaskRunOutcome runHttpTriggerTask(ScheduledTaskEntry entry) throws Exception {
        JsonNode payload = parsePayload(entry.getPayloadJson());
        OrchestrationHttpSupport.Result result = OrchestrationHttpSupport.execute(payload, objectMapper, httpClient);
        String ref = OrchestrationHttpSupport.extractRef(result.body(), objectMapper);
        String state = OrchestrationHttpSupport.extractState(result.body(), objectMapper, payload);
        Instant checked = Instant.now();
        if (ref != null && !ref.isBlank()) {
            entry.setOrchestrationRef(ref);
        }
        if (state != null && !state.isBlank()) {
            entry.setOrchestrationState(state);
            entry.setOrchestrationCheckedAt(checked);
            entry.setOrchestrationDetail(result.bodyPreview());
        }
        // Auto-poll when status URL is configured and we have a ref (or absolute statusUrl).
        boolean canPoll = (payload.has("statusUrl") && !payload.path("statusUrl").asText("").isBlank())
                || ((payload.has("statusUrlTemplate") && !payload.path("statusUrlTemplate").asText("").isBlank())
                && entry.getOrchestrationRef() != null && !entry.getOrchestrationRef().isBlank());
        if (canPoll) {
            try {
                OrchestrationHttpSupport.Result status = OrchestrationHttpSupport.fetchStatus(
                        payload,
                        entry.getOrchestrationRef(),
                        objectMapper,
                        httpClient
                );
                String polledRef = OrchestrationHttpSupport.extractRef(status.body(), objectMapper);
                if (polledRef != null && !polledRef.isBlank()) {
                    entry.setOrchestrationRef(polledRef);
                }
                String polledState = OrchestrationHttpSupport.extractState(status.body(), objectMapper, payload);
                entry.setOrchestrationState(polledState != null ? polledState : "unknown");
                entry.setOrchestrationCheckedAt(Instant.now());
                entry.setOrchestrationDetail(status.bodyPreview());
            } catch (Exception ex) {
                // Trigger succeeded; status poll is best-effort (surface in detail).
                entry.setOrchestrationDetail(
                        "trigger ok; status poll failed: "
                                + (ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName())
                );
                entry.setOrchestrationCheckedAt(Instant.now());
            }
        }
        Map<String, Object> digest = new LinkedHashMap<>();
        digest.put("method", result.method());
        digest.put("url", result.url());
        digest.put("statusCode", result.statusCode());
        if (entry.getOrchestrationRef() != null) {
            digest.put("orchestrationRef", entry.getOrchestrationRef());
        }
        if (entry.getOrchestrationState() != null) {
            digest.put("orchestrationState", entry.getOrchestrationState());
        }
        if (result.bodyPreview() != null && !result.bodyPreview().isBlank()) {
            digest.put("responsePreview", result.bodyPreview());
        }
        String message = "HTTP " + result.statusCode() + " " + result.method() + " " + result.url();
        if (entry.getOrchestrationState() != null && !entry.getOrchestrationState().isBlank()) {
            message += " · state=" + entry.getOrchestrationState();
        }
        return new TaskRunOutcome(message, digest);
    }

    private static boolean isDue(ScheduledTaskEntry entry, Instant now) {
        if (entry.getCronExpression() == null || entry.getCronExpression().isBlank()) {
            return false;
        }
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

    private boolean matchesDqScope(ScheduledTaskEntry entry, String connectionId, String database) {
        if ((connectionId == null || connectionId.isBlank()) && (database == null || database.isBlank())) {
            return true;
        }
        try {
            JsonNode payload = parsePayload(entry.getPayloadJson());
            if (connectionId != null && !connectionId.isBlank()) {
                String actual = payload.path("connectionId").asText("").trim();
                if (!connectionId.trim().equals(actual)) {
                    return false;
                }
            }
            if (database != null && !database.isBlank()) {
                String actual = payload.path("database").asText("").trim();
                if (!database.trim().equalsIgnoreCase(actual)) {
                    return false;
                }
            }
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    private boolean isBlockingRule(ScheduledTaskEntry entry) {
        try {
            JsonNode payload = parsePayload(entry.getPayloadJson());
            if (!payload.has("blocking") || payload.get("blocking").isNull()) {
                return false;
            }
            JsonNode node = payload.get("blocking");
            if (node.isBoolean()) {
                return node.asBoolean(false);
            }
            String text = node.asText("").trim().toLowerCase(Locale.ROOT);
            return "true".equals(text) || "1".equals(text) || "yes".equals(text);
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
                entry.getCreatedAt(),
                entry.getOrchestrationState(),
                entry.getOrchestrationRef(),
                entry.getOrchestrationCheckedAt(),
                entry.getOrchestrationDetail()
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
