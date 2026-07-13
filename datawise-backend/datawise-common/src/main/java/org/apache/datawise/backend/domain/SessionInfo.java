package org.apache.datawise.backend.domain;

import java.util.Map;

public record SessionInfo(
        String sessionId,
        String userName,
        boolean guest,
        Long expiresAtEpochMs,
        Long userId,
        boolean admin,
        Map<String, Boolean> featurePermissions
) {
    public SessionInfo(String sessionId, String userName, boolean guest) {
        this(sessionId, userName, guest, null, null, false, null);
    }

    public SessionInfo(String sessionId, String userName, boolean guest, Long expiresAtEpochMs) {
        this(sessionId, userName, guest, expiresAtEpochMs, null, false, null);
    }

    public SessionInfo(String sessionId, String userName, boolean guest, Long expiresAtEpochMs, Long userId) {
        this(sessionId, userName, guest, expiresAtEpochMs, userId, false, null);
    }
}
