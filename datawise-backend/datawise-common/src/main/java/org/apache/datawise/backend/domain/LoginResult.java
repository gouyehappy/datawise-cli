package org.apache.datawise.backend.domain;

public record LoginResult(
        String sessionId,
        String userName,
        String securityConfigType,
        Long expiresAtEpochMs,
        Long userId
) {
    public LoginResult(String sessionId, String userName, String securityConfigType) {
        this(sessionId, userName, securityConfigType, null, null);
    }

    public LoginResult(String sessionId, String userName, String securityConfigType, Long expiresAtEpochMs) {
        this(sessionId, userName, securityConfigType, expiresAtEpochMs, null);
    }
}
