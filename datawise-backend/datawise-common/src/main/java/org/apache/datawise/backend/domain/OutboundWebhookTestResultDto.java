package org.apache.datawise.backend.domain;

public record OutboundWebhookTestResultDto(
        boolean ok,
        int statusCode,
        String message
) {
}
