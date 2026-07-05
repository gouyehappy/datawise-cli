package org.apache.datawise.backend.domain;

public record SessionInfo(
        String sessionId,
        String userName,
        boolean guest,
        Long expiresAtEpochMs,
        Long userId
) {
    public SessionInfo(String sessionId, String userName, boolean guest) {
        this(sessionId, userName, guest, null, null);
    }

    public SessionInfo(String sessionId, String userName, boolean guest, Long expiresAtEpochMs) {
        this(sessionId, userName, guest, expiresAtEpochMs, null);
    }
}
