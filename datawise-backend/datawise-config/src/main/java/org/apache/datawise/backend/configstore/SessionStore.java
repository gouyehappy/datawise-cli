package org.apache.datawise.backend.configstore;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.model.SessionEntity;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

/**
 * 登录会话：落盘 {@code config/sessions.json}，支持 TTL 与滑动续期。
 */
@Service
public class SessionStore {

    private final JsonListFile<SessionEntity> sessions;
    private final AuthSessionPolicyService sessionPolicy;

    public SessionStore(
            ConfigDirectoryService configDirectory,
            ObjectMapper objectMapper,
            AuthSessionPolicyService sessionPolicy
    ) {
        this.sessionPolicy = sessionPolicy;
        this.sessions = new JsonListFile<>(
                configDirectory,
                objectMapper,
                ConfigPaths.SESSIONS,
                new TypeReference<List<SessionEntity>>() {
                }
        );
        purgeExpired();
    }

    public Optional<SessionEntity> findById(String id) {
        if (id == null || id.isBlank()) {
            return Optional.empty();
        }
        String normalized = id.trim();
        return sessions.stream()
                .filter(session -> normalized.equals(session.getId()))
                .findFirst();
    }

    /**
     * 校验 session 是否有效；滑动续期时刷新 {@link SessionEntity#getExpiresAt()}。
     */
    public Optional<SessionEntity> authenticate(String id) {
        Optional<SessionEntity> found = findById(id);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        SessionEntity session = found.get();
        if (!isActive(session)) {
            deleteById(id);
            return Optional.empty();
        }
        if (sessionPolicy.slidingRenewal()) {
            return Optional.of(renew(session));
        }
        return Optional.of(session);
    }

    public SessionEntity save(SessionEntity session) {
        return sessions.upsert(session, existing -> existing.getId().equals(session.getId()));
    }

    public SessionEntity create(SessionEntity session) {
        Instant now = Instant.now();
        if (session.getCreatedAt() == null) {
            session.setCreatedAt(now);
        }
        session.setExpiresAt(now.plus(sessionPolicy.ttlMinutes(), ChronoUnit.MINUTES));
        return save(session);
    }

    public SessionEntity renew(SessionEntity session) {
        session.setExpiresAt(Instant.now().plus(sessionPolicy.ttlMinutes(), ChronoUnit.MINUTES));
        return save(session);
    }

    public void deleteById(String id) {
        if (id == null || id.isBlank()) {
            return;
        }
        String normalized = id.trim();
        sessions.removeIf(session -> normalized.equals(session.getId()));
    }

    public void purgeExpired() {
        Instant now = Instant.now();
        sessions.removeIf(session -> session.getExpiresAt() != null && !session.getExpiresAt().isAfter(now));
    }

    private boolean isActive(SessionEntity session) {
        Instant expiresAt = session.getExpiresAt();
        return expiresAt == null || expiresAt.isAfter(Instant.now());
    }
}
