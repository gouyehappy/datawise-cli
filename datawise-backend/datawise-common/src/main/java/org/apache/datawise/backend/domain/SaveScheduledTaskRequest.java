package org.apache.datawise.backend.domain;

public record SaveScheduledTaskRequest(
        String id,
        String name,
        String type,
        String cronExpression,
        String payloadJson,
        Boolean enabled
) {
}
