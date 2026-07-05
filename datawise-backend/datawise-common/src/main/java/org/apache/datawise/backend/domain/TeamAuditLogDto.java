package org.apache.datawise.backend.domain;

public record TeamAuditLogDto(
        String id,
        Long actorUserId,
        String actorUserName,
        String action,
        String detail,
        String createdAt
) {
}
