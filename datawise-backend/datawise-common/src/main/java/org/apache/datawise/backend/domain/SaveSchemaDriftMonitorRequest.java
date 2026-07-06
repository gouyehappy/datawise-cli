package org.apache.datawise.backend.domain;

public record SaveSchemaDriftMonitorRequest(
        String id,
        String name,
        String sourceConnectionId,
        String sourceDatabase,
        String targetConnectionId,
        String targetDatabase,
        String tablePattern,
        Boolean enabled
) {
}
