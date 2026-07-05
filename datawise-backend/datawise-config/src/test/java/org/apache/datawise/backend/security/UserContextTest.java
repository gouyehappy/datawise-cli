package org.apache.datawise.backend.security;

import org.apache.datawise.backend.common.UnauthorizedException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class UserContextTest {

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void runAs_restoresUserOnWorkerThread() {
        UserContext.set(9L, false, "session-worker");

        Long seen = UserContext.runAs(new UserContext.Snapshot(9L, false, "session-worker"), () -> {
            assertEquals(9L, UserContext.requireUserId());
            return UserContext.getUserId();
        });

        assertEquals(9L, seen);
        assertEquals(9L, UserContext.getUserId());
    }

    @Test
    void runAs_nullSnapshotLeavesExistingContextUnchanged() {
        UserContext.set(3L, true, "session-guest");

        UserContext.runAs((UserContext.Snapshot) null, () -> {
            assertEquals(3L, UserContext.getUserId());
        });

        assertEquals(3L, UserContext.getUserId());
    }

    @Test
    void snapshotOrNull_returnsNullWithoutAuthenticatedUser() {
        assertNull(UserContext.snapshotOrNull());
    }

    @Test
    void requireUserId_throwsUnauthorizedWhenMissing() {
        UnauthorizedException ex = assertThrows(UnauthorizedException.class, UserContext::requireUserId);
        assertEquals(UnauthorizedException.CODE, ex.getMessage());
    }
}
