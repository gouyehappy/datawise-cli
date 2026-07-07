package org.apache.datawise.backend.configstore;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.model.ApiTokenEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/** API tokens for headless automation; persisted in {@code config/api-tokens.json}. */
@Service
public class ApiTokenStore {

    private final JsonListFile<ApiTokenEntity> tokens;

    public ApiTokenStore(ConfigDirectoryService configDirectory, ObjectMapper objectMapper) {
        this.tokens = new JsonListFile<>(
                configDirectory,
                objectMapper,
                ConfigPaths.API_TOKENS,
                new TypeReference<List<ApiTokenEntity>>() {
                }
        );
    }

    public List<ApiTokenEntity> listAll() {
        return tokens.snapshot();
    }

    public Optional<ApiTokenEntity> findById(String id) {
        if (id == null || id.isBlank()) {
            return Optional.empty();
        }
        String normalized = id.trim();
        return tokens.stream()
                .filter(token -> normalized.equals(token.getId()))
                .findFirst();
    }

    public Optional<ApiTokenEntity> findByTokenLookup(String tokenLookup) {
        if (tokenLookup == null || tokenLookup.isBlank()) {
            return Optional.empty();
        }
        String normalized = tokenLookup.trim();
        return tokens.stream()
                .filter(token -> normalized.equals(token.getTokenLookup()))
                .findFirst();
    }

    public ApiTokenEntity save(ApiTokenEntity token) {
        return tokens.upsert(token, existing -> existing.getId().equals(token.getId()));
    }
}
