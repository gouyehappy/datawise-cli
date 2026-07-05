package org.apache.datawise.backend.service;

import org.apache.datawise.backend.configstore.ApiTokenStore;
import org.apache.datawise.backend.model.ApiTokenEntity;
import org.apache.datawise.backend.security.ApiTokenScopes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
class ApiTokenServiceTest {

    @TempDir
    Path tempDir;

    private ApiTokenService apiTokenService;

    @BeforeEach
    void setUp() throws Exception {
        var configDirectory = new org.apache.datawise.backend.configstore.ConfigDirectoryService(tempDir);
        var objectMapper = new com.fasterxml.jackson.databind.ObjectMapper()
                .findAndRegisterModules();
        ApiTokenStore store = new ApiTokenStore(configDirectory, objectMapper);
        apiTokenService = new ApiTokenService(store, new BCryptPasswordEncoder());

        ApiTokenEntity token = new ApiTokenEntity();
        token.setId("ci-migration");
        token.setName("CI");
        token.setUserId(1L);
        token.setTokenHash(apiTokenService.hashToken("dw_test_migration_token"));
        token.setScopes(List.of(ApiTokenScopes.MIGRATION));
        token.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        store.save(token);
    }

    @Test
    void authenticatesValidToken() {
        Optional<ApiTokenEntity> found = apiTokenService.authenticate("dw_test_migration_token");
        assertTrue(found.isPresent());
        assertEqualsUser(1L, found.get());
    }

    @Test
    void rejectsInvalidToken() {
        assertFalse(apiTokenService.authenticate("wrong-token").isPresent());
    }

    private static void assertEqualsUser(long expected, ApiTokenEntity entity) {
        assertTrue(expected == entity.getUserId());
    }
}
