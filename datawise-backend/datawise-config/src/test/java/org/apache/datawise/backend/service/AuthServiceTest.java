package org.apache.datawise.backend.service;

import org.apache.datawise.backend.common.UnauthorizedException;
import org.apache.datawise.backend.configstore.AuthSessionPolicyService;
import org.apache.datawise.backend.configstore.SessionStore;
import org.apache.datawise.backend.configstore.UserStore;
import org.apache.datawise.backend.domain.AuthSessionPolicyDto;
import org.apache.datawise.backend.model.SessionEntity;
import org.apache.datawise.backend.model.UserEntity;
import org.apache.datawise.backend.security.UserContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserStore userStore;
    @Mock
    private SessionStore sessionStore;
    @Mock
    private AuthSessionPolicyService sessionPolicy;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private GuestSessionCleanupService guestSessionCleanupService;
    @Mock
    private UserAccessPolicy userAccessPolicy;
    @Mock
    private UserAdminPolicy userAdminPolicy;

    @InjectMocks
    private AuthService authService;

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void signOut_deletesCurrentSession() {
        UserContext.set(1L, false, "session-to-delete");
        when(userAccessPolicy.isGuestSession()).thenReturn(false);

        authService.signOut();

        verify(guestSessionCleanupService).cleanupSession("session-to-delete", false);
        verify(sessionStore).deleteById("session-to-delete");
    }

    @Test
    void signOut_noOpWhenNoSessionInContext() {
        authService.signOut();

        verifyNoInteractions(sessionStore);
    }

    @Test
    void getCurrentSession_returnsSessionInfoForAuthenticatedUser() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("admin");
        user.setGuest(false);
        SessionEntity session = new SessionEntity();
        session.setId("session-abc");
        session.setUserId(7L);
        session.setGuest(false);
        session.setExpiresAt(java.time.Instant.now().plusSeconds(3600));
        UserContext.set(7L, false, "session-abc");
        when(userStore.findById(7L)).thenReturn(Optional.of(user));
        when(sessionStore.findById("session-abc")).thenReturn(Optional.of(session));

        var info = authService.getCurrentSession();

        assertEquals("session-abc", info.sessionId());
        assertEquals("admin", info.userName());
        assertEquals(false, info.guest());
        assertEquals(7L, info.userId());
    }

    @Test
    void getCurrentSession_unauthorizedWhenNoUserInContext() {
        UnauthorizedException ex = assertThrows(UnauthorizedException.class, authService::getCurrentSession);
        assertEquals(UnauthorizedException.CODE, ex.getMessage());
    }

    @Test
    void changePassword_rejectsApiTokenAuth() {
        UserContext.setApiToken(7L, "token-abc", java.util.Set.of());

        UnauthorizedException ex = assertThrows(
                UnauthorizedException.class,
                () -> authService.changePassword("old-pass", "new-pass-123")
        );
        assertEquals(UnauthorizedException.CODE, ex.getMessage());
        verifyNoInteractions(userStore);
    }

    @Test
    void signOut_noOpForApiTokenAuth() {
        UserContext.setApiToken(7L, "token-abc", java.util.Set.of());

        authService.signOut();

        verifyNoInteractions(sessionStore);
        verifyNoInteractions(guestSessionCleanupService);
    }

    @Test
    void getCurrentSession_returnsSyntheticInfoForApiTokenAuth() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("automation");
        UserContext.setApiToken(7L, "token-abc", java.util.Set.of());
        when(userStore.findById(7L)).thenReturn(Optional.of(user));

        var info = authService.getCurrentSession();

        assertEquals("api-token:token-abc", info.sessionId());
        assertEquals("automation", info.userName());
        assertEquals(false, info.guest());
        assertEquals(7L, info.userId());
        verifyNoInteractions(sessionStore);
    }

    @Test
    void getSessionPolicy_requiresAuthenticatedUser() {
        when(userAccessPolicy.requireUserId()).thenThrow(new UnauthorizedException());

        UnauthorizedException ex = assertThrows(UnauthorizedException.class, authService::getSessionPolicy);
        assertEquals(UnauthorizedException.CODE, ex.getMessage());
        verifyNoInteractions(sessionPolicy);
    }

    @Test
    void updateSessionPolicy_requiresAdminUser() {
        AuthSessionPolicyDto policy = new AuthSessionPolicyDto(120, true);
        when(sessionPolicy.updatePolicy(policy)).thenReturn(policy);

        AuthSessionPolicyDto updated = authService.updateSessionPolicy(policy);

        assertEquals(policy, updated);
        verify(userAdminPolicy).requireAdminUser();
        verify(sessionPolicy).updatePolicy(policy);
    }
}
