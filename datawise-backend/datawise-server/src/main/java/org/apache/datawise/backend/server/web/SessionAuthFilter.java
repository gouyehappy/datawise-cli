package org.apache.datawise.backend.server.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.datawise.backend.configstore.SessionStore;
import org.apache.datawise.backend.model.ApiTokenEntity;
import org.apache.datawise.backend.model.SessionEntity;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.service.ApiTokenService;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

/**
 * HTTP 入口：读 {@link #SESSION_HEADER} 或 {@link #API_TOKEN_HEADER}，校验后写入 {@link UserContext}。
 */
public class SessionAuthFilter extends OncePerRequestFilter {

    public static final String SESSION_HEADER = "X-DW-Session-Id";
    public static final String API_TOKEN_HEADER = "X-DW-Api-Token";
    public static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final SessionStore sessionStore;
    private final ApiTokenService apiTokenService;

    public SessionAuthFilter(SessionStore sessionStore, ApiTokenService apiTokenService) {
        this.sessionStore = sessionStore;
        this.apiTokenService = apiTokenService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            if (!authenticateSession(request) && !authenticateApiToken(request)) {
                // anonymous request — downstream services enforce authorization
            }
            filterChain.doFilter(request, response);
        } finally {
            UserContext.clear();
        }
    }

    private boolean authenticateSession(HttpServletRequest request) {
        String sessionId = request.getHeader(SESSION_HEADER);
        if (sessionId == null || sessionId.isBlank()) {
            return false;
        }
        Optional<SessionEntity> session = sessionStore.authenticate(sessionId.trim());
        if (session.isEmpty()) {
            return false;
        }
        SessionEntity entity = session.get();
        UserContext.set(
                entity.getUserId(),
                entity.isGuest(),
                entity.getId(),
                entity.getTenantId()
        );
        return true;
    }

    private boolean authenticateApiToken(HttpServletRequest request) {
        String rawToken = resolveApiToken(request);
        if (rawToken == null) {
            return false;
        }
        Optional<ApiTokenEntity> token = apiTokenService.authenticate(rawToken);
        if (token.isEmpty()) {
            return false;
        }
        ApiTokenEntity entity = token.get();
        UserContext.setApiToken(
                entity.getUserId(),
                entity.getId(),
                normalizeScopes(entity.getScopes()),
                entity.getTenantId()
        );
        return true;
    }

    static String resolveApiToken(HttpServletRequest request) {
        String headerToken = request.getHeader(API_TOKEN_HEADER);
        if (headerToken != null && !headerToken.isBlank()) {
            return headerToken.trim();
        }
        String authorization = request.getHeader(AUTHORIZATION_HEADER);
        if (authorization != null && authorization.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            String bearer = authorization.substring(BEARER_PREFIX.length()).trim();
            if (!bearer.isBlank()) {
                return bearer;
            }
        }
        return null;
    }

    private static Set<String> normalizeScopes(java.util.List<String> scopes) {
        if (scopes == null || scopes.isEmpty()) {
            return Set.of();
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String scope : scopes) {
            if (scope != null && !scope.isBlank()) {
                normalized.add(scope.trim());
            }
        }
        return Set.copyOf(normalized);
    }
}
