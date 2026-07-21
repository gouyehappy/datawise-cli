package org.apache.datawise.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * HTTP 鉴权边界：受保护路由默认拒绝匿名；公开前缀可配置。
 */
@ConfigurationProperties(prefix = "datawise.security.auth")
public class AuthSecurityProperties {

    /**
     * When true, requests without a valid session or API token receive 401
     * unless the path matches {@link #publicPathPrefixes}.
     */
    private boolean requireAuthentication = true;

    /**
     * Only bootstrap / probe paths. Do <strong>not</strong> use a blanket {@code /api/auth/}
     * prefix — session, password, and OIDC admin APIs must stay authenticated.
     */
    private List<String> publicPathPrefixes = new ArrayList<>(List.of(
            "/login",
            "/signOut",
            "/api/auth/register",
            "/api/auth/login-options",
            "/api/auth/oidc/login",
            "/api/auth/oidc/callback",
            "/api/health",
            "/actuator/health",
            "/actuator/prometheus",
            "/v3/api-docs",
            "/swagger-ui"
    ));

    public boolean isRequireAuthentication() {
        return requireAuthentication;
    }

    public void setRequireAuthentication(boolean requireAuthentication) {
        this.requireAuthentication = requireAuthentication;
    }

    public List<String> getPublicPathPrefixes() {
        return publicPathPrefixes;
    }

    public void setPublicPathPrefixes(List<String> publicPathPrefixes) {
        this.publicPathPrefixes = publicPathPrefixes != null ? publicPathPrefixes : new ArrayList<>();
    }

    public boolean isPublicPath(String requestUri) {
        if (requestUri == null || requestUri.isBlank()) {
            return false;
        }
        String path = requestUri;
        int query = path.indexOf('?');
        if (query >= 0) {
            path = path.substring(0, query);
        }
        for (String prefix : publicPathPrefixes) {
            if (prefix == null || prefix.isBlank()) {
                continue;
            }
            if (matchesPublicPrefix(path, prefix.trim())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Exact match, or a boundary-safe prefix ({@code /login} → {@code /login/guest},
     * {@code /swagger-ui} → {@code /swagger-ui.html}), without matching
     * {@code /api/healthz} for prefix {@code /api/health}.
     */
    static boolean matchesPublicPrefix(String path, String prefix) {
        if (path.equals(prefix)) {
            return true;
        }
        if (!path.startsWith(prefix)) {
            return false;
        }
        if (path.length() == prefix.length()) {
            return true;
        }
        char next = path.charAt(prefix.length());
        return next == '/' || next == '.' || next == '-';
    }
}
