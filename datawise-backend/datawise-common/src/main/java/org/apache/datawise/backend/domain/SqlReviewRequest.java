package org.apache.datawise.backend.domain;

public record SqlReviewRequest(
        String sql,
        String connectionId,
        String database
) {
}
