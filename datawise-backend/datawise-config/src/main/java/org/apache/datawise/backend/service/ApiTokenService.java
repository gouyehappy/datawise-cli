package org.apache.datawise.backend.service;

import org.apache.datawise.backend.configstore.ApiTokenStore;
import org.apache.datawise.backend.model.ApiTokenEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class ApiTokenService {

    private final ApiTokenStore apiTokenStore;
    private final PasswordEncoder passwordEncoder;

    public ApiTokenService(ApiTokenStore apiTokenStore, PasswordEncoder passwordEncoder) {
        this.apiTokenStore = apiTokenStore;
        this.passwordEncoder = passwordEncoder;
    }

    public Optional<ApiTokenEntity> authenticate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        String token = rawToken.trim();
        for (ApiTokenEntity entity : apiTokenStore.listAll()) {
            if (entity.getTokenHash() == null || entity.getTokenHash().isBlank()) {
                continue;
            }
            if (passwordEncoder.matches(token, entity.getTokenHash())) {
                touchLastUsed(entity);
                return Optional.of(entity);
            }
        }
        return Optional.empty();
    }

    public String hashToken(String rawToken) {
        return passwordEncoder.encode(rawToken);
    }

    private void touchLastUsed(ApiTokenEntity entity) {
        entity.setLastUsedAt(Instant.now());
        apiTokenStore.save(entity);
    }
}
