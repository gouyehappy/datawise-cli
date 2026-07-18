package org.apache.datawise.backend.model;

import java.time.Instant;

/**
 * 定时任务（SQL / 分析画布 / Schema 漂移检查）。
 */
public class ScheduledTaskEntry {

    public static final String TYPE_SQL = "sql";
    public static final String TYPE_CANVAS = "canvas";
    public static final String TYPE_SCHEMA_DRIFT = "schema_drift";
    /** SQL assertion rule (empty result / row count / scalar). */
    public static final String TYPE_DATA_QUALITY = "data_quality";
    /** Outbound HTTP call to Airflow / dbt / Flink / generic orchestration APIs. */
    public static final String TYPE_HTTP_TRIGGER = "http_trigger";

    private String id;
    private String name;
    private String type = TYPE_SQL;
    private String cronExpression;
    private String payloadJson;
    private boolean enabled = true;
    private Instant lastRunAt;
    private String lastRunStatus;
    private String lastRunMessage;
    private Instant createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getCronExpression() {
        return cronExpression;
    }

    public void setCronExpression(String cronExpression) {
        this.cronExpression = cronExpression;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public void setPayloadJson(String payloadJson) {
        this.payloadJson = payloadJson;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Instant getLastRunAt() {
        return lastRunAt;
    }

    public void setLastRunAt(Instant lastRunAt) {
        this.lastRunAt = lastRunAt;
    }

    public String getLastRunStatus() {
        return lastRunStatus;
    }

    public void setLastRunStatus(String lastRunStatus) {
        this.lastRunStatus = lastRunStatus;
    }

    public String getLastRunMessage() {
        return lastRunMessage;
    }

    public void setLastRunMessage(String lastRunMessage) {
        this.lastRunMessage = lastRunMessage;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
