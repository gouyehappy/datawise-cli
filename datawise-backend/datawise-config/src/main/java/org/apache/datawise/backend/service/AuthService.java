package org.apache.datawise.backend.service;

import org.apache.datawise.backend.configstore.AuthSessionPolicyService;
import org.apache.datawise.backend.configstore.SessionStore;
import org.apache.datawise.backend.configstore.UserStore;
import org.apache.datawise.backend.domain.AuthSessionPolicyDto;
import org.apache.datawise.backend.domain.LoginResult;
import org.apache.datawise.backend.domain.SessionInfo;
import org.apache.datawise.backend.model.SessionEntity;
import org.apache.datawise.backend.model.UserEntity;
import org.apache.datawise.backend.common.UnauthorizedException;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.common.support.IdGenerator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class AuthService {

    private final UserStore userStore;
    private final SessionStore sessionStore;
    private final AuthSessionPolicyService sessionPolicy;
    private final PasswordEncoder passwordEncoder;
    private final GuestSessionCleanupService guestSessionCleanupService;
    private final UserAccessPolicy userAccessPolicy;
    private final UserAdminPolicy userAdminPolicy;

    public AuthService(
            UserStore userStore,
            SessionStore sessionStore,
            AuthSessionPolicyService sessionPolicy,
            PasswordEncoder passwordEncoder,
            GuestSessionCleanupService guestSessionCleanupService,
            UserAccessPolicy userAccessPolicy,
            UserAdminPolicy userAdminPolicy
    ) {
        this.userStore = userStore;
        this.sessionStore = sessionStore;
        this.sessionPolicy = sessionPolicy;
        this.passwordEncoder = passwordEncoder;
        this.guestSessionCleanupService = guestSessionCleanupService;
        this.userAccessPolicy = userAccessPolicy;
        this.userAdminPolicy = userAdminPolicy;
    }

    public LoginResult login(String userName, String password) {
        UserEntity user = userStore.findByUsername(userName.trim())
                .orElseThrow(() -> new IllegalArgumentException("INVALID_CREDENTIALS"));
        if (user.isGuest() || user.getPasswordHash() == null
                || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("INVALID_CREDENTIALS");
        }
        invalidateCurrentSessionIfPresent();
        return createSession(user);
    }

    public LoginResult loginAsGuest() {
        invalidateCurrentSessionIfPresent();
        UserEntity guest = userStore.findByUsername("guest")
                .orElseThrow(() -> new IllegalStateException("Guest user missing in config/users.json"));
        return createSession(guest);
    }

    public void signOut() {
        if (UserContext.isApiTokenAuth()) {
            return;
        }
        String sessionId = UserContext.getSessionId();
        boolean guest = userAccessPolicy.isGuestSession();
        if (sessionId != null) {
            guestSessionCleanupService.cleanupSession(sessionId, guest);
            sessionStore.deleteById(sessionId);
        }
    }

    public SessionInfo getCurrentSession() {
        Long userId = UserContext.requireUserId();
        UserEntity user = userStore.findById(userId)
                .orElseThrow(() -> new UnauthorizedException());
        if (UserContext.isApiTokenAuth()) {
            return new SessionInfo(
                    UserContext.getSessionId(),
                    user.getUsername(),
                    false,
                    null,
                    userId
            );
        }
        SessionEntity session = sessionStore.findById(UserContext.getSessionId())
                .orElseThrow(() -> new UnauthorizedException());
        return toSessionInfo(session, user);
    }

    public AuthSessionPolicyDto getSessionPolicy() {
        userAccessPolicy.requireUserId();
        return sessionPolicy.currentPolicy();
    }

    public AuthSessionPolicyDto updateSessionPolicy(AuthSessionPolicyDto policy) {
        userAdminPolicy.requireAdminUser();
        return sessionPolicy.updatePolicy(policy);
    }

    public void changePassword(String currentPassword, String newPassword) {
        if (UserContext.isApiTokenAuth()) {
            throw new UnauthorizedException();
        }
        userAccessPolicy.requireRegisteredUser();
        Long userId = userAccessPolicy.requireUserId();
        UserEntity user = userStore.findById(userId)
                .orElseThrow(() -> new IllegalStateException("User not found"));
        if (currentPassword == null || user.getPasswordHash() == null
                || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("INVALID_PASSWORD");
        }
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("PASSWORD_TOO_SHORT");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(Instant.now());
        userStore.saveUser(user);
    }

    private void invalidateCurrentSessionIfPresent() {
        String sessionId = UserContext.getSessionId();
        if (sessionId == null || sessionId.isBlank() || UserContext.isApiTokenAuth()) {
            return;
        }
        guestSessionCleanupService.cleanupSession(sessionId, userAccessPolicy.isGuestSession());
        sessionStore.deleteById(sessionId);
    }

    private LoginResult createSession(UserEntity user) {
        SessionEntity session = new SessionEntity();
        session.setId(IdGenerator.shortId("session-"));
        session.setUserId(user.getId());
        session.setGuest(user.isGuest());
        SessionEntity saved = sessionStore.create(session);
        return new LoginResult(
                saved.getId(),
                user.getUsername(),
                "LOCAL",
                toEpochMs(saved.getExpiresAt()),
                user.getId()
        );
    }

    private SessionInfo toSessionInfo(SessionEntity session, UserEntity user) {
        return new SessionInfo(
                session.getId(),
                user.getUsername(),
                session.isGuest(),
                toEpochMs(session.getExpiresAt()),
                user.getId()
        );
    }

    private static Long toEpochMs(Instant instant) {
        return instant != null ? instant.toEpochMilli() : null;
    }
}
