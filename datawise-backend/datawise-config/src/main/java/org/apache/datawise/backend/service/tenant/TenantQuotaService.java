package org.apache.datawise.backend.service.tenant;

import org.apache.datawise.backend.config.TenancyProperties;
import org.apache.datawise.backend.configstore.ConnectionStore;
import org.apache.datawise.backend.configstore.TenantAiUsageStore;
import org.apache.datawise.backend.configstore.TenantAiUsageStore.AiUsageSnapshot;
import org.apache.datawise.backend.domain.TenantAiUsageDto;
import org.apache.datawise.backend.domain.TenantIds;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.service.outbound.OutboundNotifySupport;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 租户级硬顶配额：连接数 + 每日 AI 调用。
 */
@Service
public class TenantQuotaService {

    private final TenancyProperties tenancyProperties;
    private final ConnectionStore connectionStore;
    private final TenantAiUsageStore aiUsageStore;
    private final OutboundNotifySupport outboundNotifySupport;
    /** In-process dedupe for quota outbound (survives JDBC store without extra columns). */
    private final Set<String> nearLimitEmittedKeys = ConcurrentHashMap.newKeySet();
    private final Set<String> exhaustedEmittedKeys = ConcurrentHashMap.newKeySet();

    public TenantQuotaService(
            TenancyProperties tenancyProperties,
            ConnectionStore connectionStore,
            TenantAiUsageStore aiUsageStore,
            OutboundNotifySupport outboundNotifySupport
    ) {
        this.tenancyProperties = tenancyProperties;
        this.connectionStore = connectionStore;
        this.aiUsageStore = aiUsageStore;
        this.outboundNotifySupport = outboundNotifySupport;
    }

    public void requireConnectionQuotaForCreate(String connectionIdBeingSaved) {
        int max = tenancyProperties.getMaxConnectionsPerTenant();
        if (max <= 0) {
            return;
        }
        String tenantId = TenantIds.normalizeOrDefault(UserContext.getTenantId());
        long count = connectionStore.findAllConnections().stream()
                .filter(c -> c != null && tenantMatches(c, tenantId))
                .filter(c -> connectionIdBeingSaved == null
                        || c.getId() == null
                        || !connectionIdBeingSaved.equals(c.getId()))
                .count();
        if (count >= max) {
            throw new IllegalArgumentException("TENANT_CONNECTION_QUOTA_EXCEEDED");
        }
    }

    /** 计一次 AI 调用；超限抛 {@code TENANT_AI_QUOTA_EXCEEDED}。 */
    public synchronized void requireAiCallQuota() {
        int max = tenancyProperties.getMaxAiCallsPerTenantPerDay();
        if (max <= 0) {
            return;
        }
        String tenantId = TenantIds.normalizeOrDefault(UserContext.getTenantId());
        String today = LocalDate.now(ZoneId.systemDefault()).toString();
        AiUsageSnapshot usage = aiUsageStore.read(tenantId);
        if (!today.equals(usage.day)) {
            usage = new AiUsageSnapshot(today, 0);
        }
        if (usage.calls >= max) {
            emitExhaustedOnce(tenantId, today, Math.max(usage.calls, max), max);
            throw new IllegalArgumentException("TENANT_AI_QUOTA_EXCEEDED");
        }
        int previousCalls = usage.calls;
        usage = new AiUsageSnapshot(today, previousCalls + 1);
        aiUsageStore.write(tenantId, usage);
        notifyQuotaThresholds(tenantId, today, previousCalls, usage.calls, max);
    }

    /** Read-only snapshot of today's AI usage for the current session tenant. */
    public synchronized TenantAiUsageDto currentAiUsage() {
        String tenantId = TenantIds.normalizeOrDefault(UserContext.getTenantId());
        int limit = tenancyProperties.getMaxAiCallsPerTenantPerDay();
        String today = LocalDate.now(ZoneId.systemDefault()).toString();
        AiUsageSnapshot usage = aiUsageStore.read(tenantId);
        int calls = today.equals(usage.day) ? Math.max(0, usage.calls) : 0;
        boolean unlimited = limit <= 0;
        int remaining = unlimited ? Integer.MAX_VALUE : Math.max(0, limit - calls);
        return new TenantAiUsageDto(tenantId, today, calls, unlimited ? 0 : limit, remaining, unlimited);
    }

    static boolean isNearLimit(int remaining, int limit) {
        if (limit <= 0 || remaining <= 0) {
            return false;
        }
        return remaining <= 5 || remaining * 10 <= limit;
    }

    private void notifyQuotaThresholds(String tenantId, String day, int previousCalls, int calls, int max) {
        int remainingBefore = Math.max(0, max - previousCalls);
        int remainingAfter = Math.max(0, max - calls);
        boolean wasNear = isNearLimit(remainingBefore, max);
        boolean nowNear = isNearLimit(remainingAfter, max);
        if (nowNear && !wasNear) {
            String key = notifyKey(tenantId, day, "near");
            if (nearLimitEmittedKeys.add(key)) {
                Long userId = UserContext.getUserId();
                if (userId != null) {
                    outboundNotifySupport.aiQuotaNearLimit(tenantId, calls, max, remainingAfter, userId);
                }
            }
        }
        if (remainingAfter == 0) {
            emitExhaustedOnce(tenantId, day, calls, max);
        }
    }

    private void emitExhaustedOnce(String tenantId, String day, int calls, int max) {
        String key = notifyKey(tenantId, day, "exhausted");
        if (!exhaustedEmittedKeys.add(key)) {
            return;
        }
        Long userId = UserContext.getUserId();
        if (userId != null) {
            outboundNotifySupport.aiQuotaExhausted(tenantId, calls, max, userId);
        }
    }

    private static String notifyKey(String tenantId, String day, String kind) {
        return tenantId + "|" + day + "|" + kind;
    }

    private static boolean tenantMatches(ConnectionEntity connection, String tenantId) {
        String cid = connection.getTenantId();
        if (cid == null || cid.isBlank()) {
            return TenantIds.DEFAULT.equals(tenantId);
        }
        return tenantId.equals(cid.trim());
    }
}
