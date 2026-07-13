package org.apache.datawise.backend.domain;

import java.util.Map;

public record LoginResult(
        String sessionId,
        String userName,
        String securityConfigType,
        Long expiresAtEpochMs,
        Long userId,
        boolean admin,
        Map<String, Boolean> featurePermissions
) {
    public LoginResult(String sessionId, String userName, String securityConfigType) {
        this(sessionId, userName, securityConfigType, null, null, false, null);
    }

    public LoginResult(String sessionId, String userName, String securityConfigType, Long expiresAtEpochMs) {
        this(sessionId, userName, securityConfigType, expiresAtEpochMs, null, false, null);
    }

    public LoginResult(String sessionId, String userName, String securityConfigType, Long expiresAtEpochMs, Long userId) {
        this(sessionId, userName, securityConfigType, expiresAtEpochMs, userId, false, null);
    }
}
