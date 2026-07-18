package org.apache.datawise.backend.domain;

/** Current-session tenant daily AI call usage snapshot. */
public record TenantAiUsageDto(
        String tenantId,
        String day,
        int calls,
        int limit,
        int remaining,
        boolean unlimited
) {
}
