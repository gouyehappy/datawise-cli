package org.apache.datawise.backend.service.outbound;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.apache.datawise.backend.configstore.OutboundWebhookStore;
import org.apache.datawise.backend.domain.OutboundEvent;
import org.apache.datawise.backend.domain.TenantIds;
import org.apache.datawise.backend.model.OutboundWebhookEntity;
import org.apache.datawise.backend.security.UserContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Delivers {@link OutboundEvent} to matching <strong>tenant</strong> webhooks via HTTP POST.
 * Channel failures never propagate to callers.
 */
@Service
public class OutboundEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboundEventPublisher.class);
    private static final int MAX_ATTEMPTS = 3;

    private final OutboundWebhookStore webhookStore;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public OutboundEventPublisher(OutboundWebhookStore webhookStore, ObjectMapper objectMapper) {
        this.webhookStore = webhookStore;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    /**
     * 投递到当前会话租户的 Webhook（recipients 仅保留兼容；租户级通道只投一次）。
     */
    public void publishForUsers(OutboundEvent event, Collection<Long> recipientUserIds) {
        if (event == null) {
            return;
        }
        if (recipientUserIds == null || recipientUserIds.isEmpty()) {
            return;
        }
        String tenantId = TenantIds.normalizeOrDefault(UserContext.getTenantId());
        try {
            deliverToTenant(tenantId, event);
        } catch (RuntimeException ex) {
            ExceptionLogging.recoverable(log, "outbound.publish tenantId=" + tenantId + " type=" + event.type(), ex);
        }
    }

    public void publishForTenant(String tenantId, OutboundEvent event) {
        if (event == null) {
            return;
        }
        try {
            deliverToTenant(TenantIds.normalizeOrDefault(tenantId), event);
        } catch (RuntimeException ex) {
            ExceptionLogging.recoverable(log, "outbound.publish tenantId=" + tenantId + " type=" + event.type(), ex);
        }
    }

    /**
     * Delivers to matching tenant hooks and collects ticket browse URLs from issue-channel responses.
     */
    public List<String> publishCollectingTicketUrls(OutboundEvent event) {
        if (event == null) {
            return List.of();
        }
        String tenantId = TenantIds.normalizeOrDefault(UserContext.getTenantId());
        List<String> urls = new ArrayList<>();
        try {
            List<OutboundWebhookEntity> hooks = webhookStore.listByTenantId(tenantId);
            for (OutboundWebhookEntity webhook : hooks) {
                if (!webhook.isEnabled()) {
                    continue;
                }
                if (!matchesEvent(webhook, event.type())) {
                    continue;
                }
                DeliveryResult result = post(webhook, event, tenantId, true);
                if (!result.ok()) {
                    continue;
                }
                String url = OutboundTicketUrlSupport.extractTicketUrl(webhook.getChannel(), result.responseBody());
                if (url != null && !url.isBlank() && !urls.contains(url)) {
                    urls.add(url);
                }
            }
        } catch (RuntimeException ex) {
            ExceptionLogging.recoverable(log, "outbound.publishCollectingTicketUrls tenantId=" + tenantId
                    + " type=" + event.type(), ex);
        }
        return List.copyOf(urls);
    }

    public DeliveryResult deliverOnce(String tenantId, OutboundWebhookEntity webhook, OutboundEvent event) {
        return post(webhook, event, TenantIds.normalizeOrDefault(tenantId), true);
    }

    /** @deprecated 使用 {@link #deliverOnce(String, OutboundWebhookEntity, OutboundEvent)} */
    @Deprecated
    public DeliveryResult deliverOnce(long userId, OutboundWebhookEntity webhook, OutboundEvent event) {
        return deliverOnce(TenantIds.DEFAULT, webhook, event);
    }

    private void deliverToTenant(String tenantId, OutboundEvent event) {
        List<OutboundWebhookEntity> hooks = webhookStore.listByTenantId(tenantId);
        for (OutboundWebhookEntity webhook : hooks) {
            if (!webhook.isEnabled()) {
                continue;
            }
            if (!matchesEvent(webhook, event.type())) {
                continue;
            }
            post(webhook, event, tenantId, true);
        }
    }

    private boolean matchesEvent(OutboundWebhookEntity webhook, String type) {
        List<String> types = webhook.getEventTypes();
        if (types == null || types.isEmpty()) {
            return true;
        }
        return types.stream().anyMatch(item -> type != null && type.equals(item.trim()));
    }

    private DeliveryResult post(
            OutboundWebhookEntity webhook,
            OutboundEvent event,
            String tenantId,
            boolean persistStatus
    ) {
        String url = webhook.getUrl() != null ? webhook.getUrl().trim() : "";
        if (url.isEmpty()) {
            return DeliveryResult.failed(0, "url is empty");
        }
        try {
            Map<String, Object> genericPayload = buildPayload(event, webhook.isIncludeSql());
            OutboundChannelPayloadSupport.PreparedRequest prepared = OutboundChannelPayloadSupport.prepare(
                    webhook.getChannel(),
                    url,
                    webhook.getSecret(),
                    event,
                    genericPayload
            );
            byte[] body = objectMapper.writeValueAsBytes(prepared.body());
            int timeoutMs = Math.max(1000, Math.min(webhook.getTimeoutMs() <= 0 ? 5000 : webhook.getTimeoutMs(), 30000));
            Exception lastError = null;
            for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                try {
                    HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(prepared.url()))
                            .timeout(Duration.ofMillis(timeoutMs))
                            .header("Content-Type", "application/json; charset=utf-8")
                            .header("User-Agent", "DataWise-Outbound/1.0")
                            .header("X-DataWise-Event", event.type())
                            .header("X-DataWise-Delivery", event.id())
                            .header("X-DataWise-Tenant", tenantId)
                            .POST(HttpRequest.BodyPublishers.ofByteArray(body));
                    if (prepared.extraHeaders() != null) {
                        for (Map.Entry<String, String> header : prepared.extraHeaders().entrySet()) {
                            if (header.getKey() == null || header.getKey().isBlank()
                                    || header.getValue() == null) {
                                continue;
                            }
                            builder.header(header.getKey(), header.getValue());
                        }
                    }
                    if (prepared.applyDataWiseSignature()) {
                        String signature = sign(webhook.getSecret(), body);
                        if (signature != null) {
                            builder.header("X-DataWise-Signature", "sha256=" + signature);
                        }
                    }
                    HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
                    int status = response.statusCode();
                    if (status >= 200 && status < 300) {
                        if (persistStatus) {
                            markSuccess(tenantId, webhook);
                        }
                        return DeliveryResult.ok(status, response.body());
                    }
                    lastError = new IllegalStateException("HTTP " + status);
                } catch (Exception ex) {
                    lastError = ex;
                    if (attempt < MAX_ATTEMPTS) {
                        Thread.sleep(100L * attempt);
                    }
                }
            }
            String message = lastError != null && lastError.getMessage() != null
                    ? lastError.getMessage()
                    : "delivery failed";
            if (persistStatus) {
                markFailure(tenantId, webhook, message);
            }
            return DeliveryResult.failed(0, message);
        } catch (Exception ex) {
            String message = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
            if (persistStatus) {
                markFailure(tenantId, webhook, message);
            }
            ExceptionLogging.recoverable(
                    log,
                    "outbound.webhook tenantId=" + tenantId + " webhookId=" + webhook.getId(),
                    ex
            );
            return DeliveryResult.failed(0, message);
        }
    }

    private Map<String, Object> buildPayload(OutboundEvent event, boolean includeSql) {
        Map<String, Object> data = new LinkedHashMap<>(event.data());
        if (!includeSql) {
            data.remove("sql");
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", event.id());
        payload.put("type", event.type());
        payload.put("occurredAt", event.occurredAt() != null ? event.occurredAt().toString() : Instant.now().toString());
        payload.put("title", event.title());
        payload.put("body", event.body());
        payload.put("data", data);
        return payload;
    }

    private static String sign(String secret, byte[] body) {
        if (secret == null || secret.isBlank()) {
            return null;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.trim().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(body));
        } catch (Exception ex) {
            return null;
        }
    }

    private void markSuccess(String tenantId, OutboundWebhookEntity webhook) {
        webhook.setLastSuccessAt(Instant.now());
        webhook.setLastError(null);
        webhook.setUpdatedAt(Instant.now());
        webhookStore.save(tenantId, webhook);
    }

    private void markFailure(String tenantId, OutboundWebhookEntity webhook, String message) {
        webhook.setLastFailureAt(Instant.now());
        webhook.setLastError(message != null && message.length() > 500 ? message.substring(0, 500) : message);
        webhook.setUpdatedAt(Instant.now());
        webhookStore.save(tenantId, webhook);
    }

    public record DeliveryResult(boolean ok, int statusCode, String message, String responseBody) {
        public static DeliveryResult ok(int statusCode) {
            return ok(statusCode, null);
        }

        public static DeliveryResult ok(int statusCode, String responseBody) {
            return new DeliveryResult(true, statusCode, "ok", responseBody);
        }

        public static DeliveryResult failed(int statusCode, String message) {
            return new DeliveryResult(false, statusCode, message, null);
        }
    }
}
