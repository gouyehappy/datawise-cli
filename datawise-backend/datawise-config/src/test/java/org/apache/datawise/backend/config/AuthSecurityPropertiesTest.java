package org.apache.datawise.backend.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthSecurityPropertiesTest {

    @Test
    void allowsBootstrapAuthAndHealthOnly() {
        AuthSecurityProperties props = new AuthSecurityProperties();
        assertTrue(props.isPublicPath("/api/health"));
        assertTrue(props.isPublicPath("/login"));
        assertTrue(props.isPublicPath("/login/guest"));
        assertTrue(props.isPublicPath("/signOut"));
        assertTrue(props.isPublicPath("/api/auth/login-options"));
        assertTrue(props.isPublicPath("/api/auth/register"));
        assertTrue(props.isPublicPath("/api/auth/oidc/login"));
        assertTrue(props.isPublicPath("/api/auth/oidc/callback"));
        assertTrue(props.isPublicPath("/actuator/prometheus"));
        assertTrue(props.isPublicPath("/v3/api-docs"));
        assertTrue(props.isPublicPath("/swagger-ui.html"));
        assertTrue(props.isPublicPath("/swagger-ui/index.html"));
    }

    @Test
    void rejectsProtectedAuthAndApiPaths() {
        AuthSecurityProperties props = new AuthSecurityProperties();
        assertFalse(props.isPublicPath("/api/auth/session"));
        assertFalse(props.isPublicPath("/api/auth/oidc/config"));
        assertFalse(props.isPublicPath("/api/auth/change-password"));
        assertFalse(props.isPublicPath("/api/auth/session-policy"));
        assertFalse(props.isPublicPath("/api/auth/switch-tenant"));
        assertFalse(props.isPublicPath("/api/explorer/tree"));
        assertFalse(props.isPublicPath("/api/sql/execute"));
        assertFalse(props.isPublicPath("/api/system/metrics"));
    }

    @Test
    void doesNotMatchLongerSiblingPaths() {
        assertFalse(AuthSecurityProperties.matchesPublicPrefix("/api/healthz", "/api/health"));
        assertTrue(AuthSecurityProperties.matchesPublicPrefix("/api/health", "/api/health"));
        assertTrue(AuthSecurityProperties.matchesPublicPrefix("/login/guest", "/login"));
        assertFalse(AuthSecurityProperties.matchesPublicPrefix("/loginX", "/login"));
    }
}
