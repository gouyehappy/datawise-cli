package org.apache.datawise.backend.domain;

import java.util.List;

public record SaveOutboundWebhookRequest(
        String id,
        String name,
        Boolean enabled,
        String channel,
        String url,
        String secret,
        List<String> eventTypes,
        Integer timeoutMs,
        Boolean includeSql
) {
}
