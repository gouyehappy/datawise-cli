package org.apache.datawise.backend.service.outbound;

import org.apache.datawise.backend.common.support.IdGenerator;
import org.apache.datawise.backend.configstore.OutboundWebhookStore;
import org.apache.datawise.backend.domain.OutboundEvent;
import org.apache.datawise.backend.domain.OutboundEventType;
import org.apache.datawise.backend.domain.OutboundWebhookChannels;
import org.apache.datawise.backend.domain.OutboundWebhookDto;
import org.apache.datawise.backend.domain.OutboundWebhookTestResultDto;
import org.apache.datawise.backend.domain.SaveOutboundWebhookRequest;
import org.apache.datawise.backend.domain.TenantIds;
import org.apache.datawise.backend.model.OutboundWebhookEntity;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.service.UserAccessPolicy;
import org.apache.datawise.backend.service.UserAdminPolicy;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class OutboundWebhookService {

    private static final DateTimeFormatter FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.systemDefault());

    private final OutboundWebhookStore webhookStore;
    private final OutboundEventPublisher publisher;
    private final UserAccessPolicy userAccessPolicy;
    private final UserAdminPolicy userAdminPolicy;

    public OutboundWebhookService(
            OutboundWebhookStore webhookStore,
            OutboundEventPublisher publisher,
            UserAccessPolicy userAccessPolicy,
            UserAdminPolicy userAdminPolicy
    ) {
        this.webhookStore = webhookStore;
        this.publisher = publisher;
        this.userAccessPolicy = userAccessPolicy;
        this.userAdminPolicy = userAdminPolicy;
    }

    public List<OutboundWebhookDto> list() {
        userAccessPolicy.requireRegisteredUser();
        return webhookStore.listByTenantId(currentTenantId()).stream()
                .map(this::toDto)
                .toList();
    }

    public OutboundWebhookDto save(SaveOutboundWebhookRequest request) {
        userAdminPolicy.requireAdminUser();
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        if (request.url() == null || request.url().isBlank()) {
            throw new IllegalArgumentException("url is required");
        }
        if (request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        String tenantId = currentTenantId();
        Instant now = Instant.now();
        OutboundWebhookEntity entity;
        if (request.id() != null && !request.id().isBlank()) {
            entity = webhookStore.findById(tenantId, request.id())
                    .orElseThrow(() -> new IllegalArgumentException("webhook not found"));
        } else {
            entity = new OutboundWebhookEntity();
            entity.setId(IdGenerator.shortId("hook-"));
            entity.setCreatedAt(now);
        }
        entity.setName(request.name().trim());
        entity.setUrl(request.url().trim());
        entity.setChannel(OutboundWebhookChannels.normalize(request.channel()));
        if (request.enabled() != null) {
            entity.setEnabled(request.enabled());
        }
        if (request.secret() != null) {
            String secret = request.secret().trim();
            entity.setSecret(secret.isEmpty() ? null : secret);
        }
        if (request.eventTypes() != null) {
            entity.setEventTypes(new ArrayList<>(request.eventTypes()));
        }
        if (request.timeoutMs() != null) {
            entity.setTimeoutMs(Math.max(1000, Math.min(request.timeoutMs(), 30000)));
        }
        if (request.includeSql() != null) {
            entity.setIncludeSql(request.includeSql());
        }
        entity.setUpdatedAt(now);
        return toDto(webhookStore.save(tenantId, entity));
    }

    public void delete(String id) {
        userAdminPolicy.requireAdminUser();
        webhookStore.delete(currentTenantId(), id);
    }

    public OutboundWebhookTestResultDto test(String id) {
        userAdminPolicy.requireAdminUser();
        String tenantId = currentTenantId();
        OutboundWebhookEntity webhook = webhookStore.findById(tenantId, id)
                .orElseThrow(() -> new IllegalArgumentException("webhook not found"));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("webhookId", webhook.getId());
        data.put("tenantId", tenantId);
        data.put("userId", UserContext.getUserId());
        OutboundEvent event = new OutboundEvent(
                IdGenerator.shortId("evt-"),
                OutboundEventType.OUTBOUND_TEST,
                Instant.now(),
                "DataWise webhook test",
                "Outbound webhook connectivity check",
                data
        );
        OutboundEventPublisher.DeliveryResult result = publisher.deliverOnce(tenantId, webhook, event);
        return new OutboundWebhookTestResultDto(result.ok(), result.statusCode(), result.message());
    }

    private String currentTenantId() {
        return TenantIds.normalizeOrDefault(UserContext.getTenantId());
    }

    private OutboundWebhookDto toDto(OutboundWebhookEntity entity) {
        return new OutboundWebhookDto(
                entity.getId(),
                entity.getName(),
                entity.isEnabled(),
                OutboundWebhookChannels.normalize(
                        entity.getChannel() != null ? entity.getChannel() : OutboundWebhookChannels.WEBHOOK
                ),
                entity.getUrl(),
                entity.getSecret() != null && !entity.getSecret().isBlank(),
                entity.getEventTypes() != null ? List.copyOf(entity.getEventTypes()) : List.of(),
                entity.getTimeoutMs(),
                entity.isIncludeSql(),
                format(entity.getCreatedAt()),
                format(entity.getUpdatedAt()),
                format(entity.getLastSuccessAt()),
                format(entity.getLastFailureAt()),
                entity.getLastError()
        );
    }

    private static String format(Instant instant) {
        return instant != null ? FMT.format(instant) : null;
    }
}
