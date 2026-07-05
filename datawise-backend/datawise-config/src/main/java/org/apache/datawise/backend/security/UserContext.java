package org.apache.datawise.backend.security;

import org.apache.datawise.backend.common.UnauthorizedException;

import java.util.function.Supplier;

public final class UserContext {

    private static final ThreadLocal<Long> USER_ID = new ThreadLocal<>();
    private static final ThreadLocal<Boolean> GUEST = new ThreadLocal<>();
    private static final ThreadLocal<String> SESSION_ID = new ThreadLocal<>();
    private static final ThreadLocal<java.util.Set<String>> API_TOKEN_SCOPES = new ThreadLocal<>();

    public record Snapshot(Long userId, boolean guest, String sessionId) {
    }

    private UserContext() {
    }

    public static void set(Long userId, boolean guest, String sessionId) {
        USER_ID.set(userId);
        GUEST.set(guest);
        SESSION_ID.set(sessionId);
        API_TOKEN_SCOPES.remove();
    }

    public static void setApiToken(Long userId, String tokenId, java.util.Set<String> scopes) {
        USER_ID.set(userId);
        GUEST.set(false);
        SESSION_ID.set("api-token:" + tokenId);
        API_TOKEN_SCOPES.set(scopes == null ? java.util.Set.of() : java.util.Set.copyOf(scopes));
    }

    public static boolean isApiTokenAuth() {
        String sessionId = getSessionId();
        return sessionId != null && sessionId.startsWith("api-token:");
    }

    public static boolean hasApiTokenScope(String scope) {
        java.util.Set<String> scopes = API_TOKEN_SCOPES.get();
        return scopes != null && scopes.contains(scope);
    }

    public static Snapshot snapshotOrNull() {
        Long userId = getUserId();
        if (userId == null) {
            return null;
        }
        return new Snapshot(userId, isGuest(), getSessionId());
    }

    public static <T> T runAs(Snapshot snapshot, Supplier<T> task) {
        Snapshot previous = snapshotOrNull();
        if (snapshot != null && snapshot.userId() != null) {
            set(snapshot.userId(), snapshot.guest(), snapshot.sessionId());
        }
        try {
            return task.get();
        } finally {
            if (previous != null) {
                set(previous.userId(), previous.guest(), previous.sessionId());
            } else {
                clear();
            }
        }
    }

    public static void runAs(Snapshot snapshot, Runnable task) {
        runAs(snapshot, () -> {
            task.run();
            return null;
        });
    }

    public static Long getUserId() {
        return USER_ID.get();
    }

    public static Long requireUserId() {
        Long userId = USER_ID.get();
        if (userId == null) {
            throw new UnauthorizedException();
        }
        return userId;
    }

    public static boolean isGuest() {
        return Boolean.TRUE.equals(GUEST.get());
    }

    public static String getSessionId() {
        return SESSION_ID.get();
    }

    public static void clear() {
        USER_ID.remove();
        GUEST.remove();
        SESSION_ID.remove();
        API_TOKEN_SCOPES.remove();
    }
}
