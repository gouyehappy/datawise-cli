package org.apache.datawise.backend.domain;

public record KillSessionRequest(
        String connectionId,
        String database,
        String sessionId,
        String mode
) {
}
