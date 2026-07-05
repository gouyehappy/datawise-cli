package org.apache.datawise.backend.domain;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ConnectionEntryDto(
        String id,
        String groupId,
        int sortOrder,
        Long userId,
        ConnectionConfig config
) {
}
