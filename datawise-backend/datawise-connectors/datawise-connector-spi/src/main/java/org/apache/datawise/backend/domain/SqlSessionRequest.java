package org.apache.datawise.backend.domain;

public record SqlSessionRequest(String sessionKey, String connectionId, String database) {
}
