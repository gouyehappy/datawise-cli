package org.apache.datawise.backend.domain;

public record CancelSqlExecutionRequest(
        String sessionKey,
        String mode
) {
}
