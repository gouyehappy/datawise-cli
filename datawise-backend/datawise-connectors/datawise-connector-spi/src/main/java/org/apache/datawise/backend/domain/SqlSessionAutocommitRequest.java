package org.apache.datawise.backend.domain;

public record SqlSessionAutocommitRequest(
        String sessionKey,
        String connectionId,
        String database,
        boolean autocommit
) {
}
