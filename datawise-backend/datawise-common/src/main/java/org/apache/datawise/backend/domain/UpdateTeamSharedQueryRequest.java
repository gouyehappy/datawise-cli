package org.apache.datawise.backend.domain;

import java.util.List;

public record UpdateTeamSharedQueryRequest(
        String title,
        String description,
        String connectionId,
        String connectionName,
        String database,
        String sql,
        List<String> tags
) {
    public UpdateTeamSharedQueryRequest {
        tags = tags != null ? List.copyOf(tags) : List.of();
    }
}
