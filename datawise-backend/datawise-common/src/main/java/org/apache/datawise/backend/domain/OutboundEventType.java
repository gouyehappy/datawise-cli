package org.apache.datawise.backend.domain;

/** Stable outbound notification event type identifiers. */
public final class OutboundEventType {

    public static final String SCHEDULED_TASK_OK = "scheduled_task.ok";
    public static final String SCHEDULED_TASK_FAILED = "scheduled_task.failed";
    public static final String PROD_APPROVAL_PENDING = "prod.approval.pending";
    public static final String PROD_APPROVAL_DECIDED = "prod.approval.decided";
    public static final String SCHEMA_DRIFT_DETECTED = "schema_drift.detected";
    public static final String SCHEMA_DRIFT_CLEAN = "schema_drift.clean";
    public static final String AUDIT_APPENDED = "audit.appended";
    public static final String INSIGHT_DIGEST = "insight.digest";
    /** Manual or automated Insight → ticket / runbook export. */
    public static final String INSIGHT_ACTION = "insight.action";
    public static final String DATA_QUALITY_OK = "data_quality.ok";
    public static final String DATA_QUALITY_FAILED = "data_quality.failed";
    public static final String ORCHESTRATION_TRIGGERED = "orchestration.triggered";
    public static final String ORCHESTRATION_FAILED = "orchestration.failed";
    /** Tenant AI daily quota crossed into near-limit band (≤10% or ≤5 remaining). */
    public static final String AI_QUOTA_NEAR_LIMIT = "ai.quota.near_limit";
    /** Tenant AI daily quota fully consumed. */
    public static final String AI_QUOTA_EXHAUSTED = "ai.quota.exhausted";
    public static final String OUTBOUND_TEST = "outbound.test";

    private OutboundEventType() {
    }
}
