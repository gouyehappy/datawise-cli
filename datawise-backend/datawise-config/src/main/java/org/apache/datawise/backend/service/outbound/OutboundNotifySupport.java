package org.apache.datawise.backend.service.outbound;

import org.apache.datawise.backend.common.support.IdGenerator;
import org.apache.datawise.backend.domain.OutboundEvent;
import org.apache.datawise.backend.domain.OutboundEventType;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Helpers to build and publish Wave A outbound events without breaking callers. */
@Component
public class OutboundNotifySupport {

    private final OutboundEventPublisher publisher;

    public OutboundNotifySupport(OutboundEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void publish(String type, String title, String body, Map<String, Object> data, Collection<Long> recipients) {
        if (recipients == null || recipients.isEmpty()) {
            return;
        }
        OutboundEvent event = new OutboundEvent(
                IdGenerator.shortId("evt-"),
                type,
                Instant.now(),
                title,
                body,
                data != null ? data : Map.of()
        );
        publisher.publishForUsers(event, recipients);
    }

    public void scheduledTask(boolean ok, String taskName, String taskType, String message, Long userId) {
        if (userId == null) {
            return;
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("name", taskName != null ? taskName : "");
        data.put("type", taskType != null ? taskType : "");
        data.put("message", message != null ? message : "");
        publish(
                ok ? OutboundEventType.SCHEDULED_TASK_OK : OutboundEventType.SCHEDULED_TASK_FAILED,
                ok ? "Scheduled task succeeded" : "Scheduled task failed",
                taskName != null ? taskName : "",
                data,
                List.of(userId)
        );
    }

    public void productionApprovalPending(
            String teamId,
            String approvalId,
            String connectionId,
            Long requesterUserId,
            Collection<Long> managerUserIds
    ) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("teamId", teamId);
        data.put("approvalId", approvalId);
        data.put("connectionId", connectionId);
        data.put("requesterUserId", requesterUserId);
        publish(
                OutboundEventType.PROD_APPROVAL_PENDING,
                "Production approval pending",
                "A production SQL change awaits review",
                data,
                managerUserIds
        );
    }

    public void productionApprovalDecided(
            String teamId,
            String approvalId,
            String status,
            Long requesterUserId,
            Collection<Long> recipients
    ) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("teamId", teamId);
        data.put("approvalId", approvalId);
        data.put("status", status);
        data.put("requesterUserId", requesterUserId);
        publish(
                OutboundEventType.PROD_APPROVAL_DECIDED,
                "Production approval " + status,
                "Approval " + approvalId + " is now " + status,
                data,
                recipients
        );
    }

    public void schemaDrift(boolean detected, String monitorId, int driftCount, Long userId) {
        if (userId == null) {
            return;
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("monitorId", monitorId);
        data.put("driftCount", driftCount);
        publish(
                detected ? OutboundEventType.SCHEMA_DRIFT_DETECTED : OutboundEventType.SCHEMA_DRIFT_CLEAN,
                detected ? "Schema drift detected" : "Schema drift check clean",
                "monitor=" + monitorId + " driftCount=" + driftCount,
                data,
                List.of(userId)
        );
    }

    public void auditAppended(String teamId, String action, String detail, boolean includeSqlHint, Collection<Long> recipients) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("teamId", teamId);
        data.put("action", action);
        data.put("detail", detail != null ? detail : "");
        if (includeSqlHint && detail != null && detail.contains("sql:")) {
            int idx = detail.indexOf("sql:");
            data.put("sql", detail.substring(idx + 4));
        }
        publish(
                OutboundEventType.AUDIT_APPENDED,
                "Team audit event",
                action != null ? action : "",
                data,
                recipients
        );
    }

    public void insightDigest(
            String taskName,
            String taskType,
            String summary,
            Map<String, Object> digestData,
            Long userId
    ) {
        if (userId == null) {
            return;
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("name", taskName != null ? taskName : "");
        data.put("type", taskType != null ? taskType : "");
        if (digestData != null) {
            data.putAll(digestData);
        }
        publish(
                OutboundEventType.INSIGHT_DIGEST,
                "Insight digest",
                summary != null && !summary.isBlank() ? summary : (taskName != null ? taskName : ""),
                data,
                List.of(userId)
        );
    }

    /**
     * Publish {@link OutboundEventType#INSIGHT_ACTION} so GitHub/GitLab issue channels (or webhooks)
     * can open a ticket / runbook follow-up from an insight.
     */
    public String insightAction(String title, String body, Map<String, Object> details, Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("user is required");
        }
        String resolvedTitle = title != null && !title.isBlank() ? title.trim() : "DataWise insight action";
        String resolvedBody = body != null ? body.trim() : "";
        Map<String, Object> data = new LinkedHashMap<>();
        if (details != null) {
            data.putAll(details);
        }
        String eventId = IdGenerator.shortId("evt-");
        OutboundEvent event = new OutboundEvent(
                eventId,
                OutboundEventType.INSIGHT_ACTION,
                Instant.now(),
                resolvedTitle,
                resolvedBody,
                data
        );
        publisher.publishForUsers(event, List.of(userId));
        return eventId;
    }

    public void dataQuality(boolean ok, String ruleName, String message, Map<String, Object> details, Long userId) {
        if (userId == null) {
            return;
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("name", ruleName != null ? ruleName : "");
        data.put("message", message != null ? message : "");
        if (details != null) {
            data.putAll(details);
        }
        publish(
                ok ? OutboundEventType.DATA_QUALITY_OK : OutboundEventType.DATA_QUALITY_FAILED,
                ok ? "Data quality check passed" : "Data quality check failed",
                ruleName != null ? ruleName : "",
                data,
                List.of(userId)
        );
    }

    public void orchestration(boolean ok, String taskName, String message, Map<String, Object> details, Long userId) {
        if (userId == null) {
            return;
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("name", taskName != null ? taskName : "");
        data.put("message", message != null ? message : "");
        if (details != null) {
            data.putAll(details);
        }
        publish(
                ok ? OutboundEventType.ORCHESTRATION_TRIGGERED : OutboundEventType.ORCHESTRATION_FAILED,
                ok ? "Orchestration trigger succeeded" : "Orchestration trigger failed",
                taskName != null ? taskName : "",
                data,
                List.of(userId)
        );
    }
}
