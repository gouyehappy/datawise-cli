package org.apache.datawise.backend.server.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.datawise.backend.common.UnauthorizedException;
import org.apache.datawise.backend.config.AuthSecurityProperties;
import org.apache.datawise.backend.configstore.SessionStore;
import org.apache.datawise.backend.model.ApiTokenEntity;
import org.apache.datawise.backend.model.SessionEntity;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.service.ApiTokenService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * HTTP 入口：读 {@link #SESSION_HEADER} 或 {@link #API_TOKEN_HEADER}，校验后写入 {@link UserContext}。
 * 当 {@link AuthSecurityProperties#isRequireAuthentication()} 为 true 时，非公开路径匿名请求返回 401。
 *
 * <p>401 在到达 Spring MVC CORS 之前短路，因此必须在此补齐与 {@code WebConfig} 一致的 CORS 头，
 * 否则浏览器会把真实 401 伪装成网络/CORS 失败，前端无法触发会话恢复。
 */
public class SessionAuthFilter extends OncePerRequestFilter {

    public static final String SESSION_HEADER = "X-DW-Session-Id";
    public static final String API_TOKEN_HEADER = "X-DW-Api-Token";
    public static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    /** 与 {@code WebConfig#addCorsMappings} 保持一致 */
    private static final Pattern[] ALLOWED_ORIGIN_PATTERNS = {
            Pattern.compile("^https?://localhost(:\\d+)?$", Pattern.CASE_INSENSITIVE),
            Pattern.compile("^https?://127\\.0\\.0\\.1(:\\d+)?$", Pattern.CASE_INSENSITIVE),
            Pattern.compile("^app://local$", Pattern.CASE_INSENSITIVE),
            Pattern.compile("^app://.+$", Pattern.CASE_INSENSITIVE),
    };

    private final SessionStore sessionStore;
    private final ApiTokenService apiTokenService;
    private final AuthSecurityProperties authSecurityProperties;

    public SessionAuthFilter(
            SessionStore sessionStore,
            ApiTokenService apiTokenService,
            AuthSecurityProperties authSecurityProperties
    ) {
        this.sessionStore = sessionStore;
        this.apiTokenService = apiTokenService;
        this.authSecurityProperties = authSecurityProperties != null
                ? authSecurityProperties
                : new AuthSecurityProperties();
    }

    /** Test / legacy constructor — authentication required by default. */
    public SessionAuthFilter(SessionStore sessionStore, ApiTokenService apiTokenService) {
        this(sessionStore, apiTokenService, new AuthSecurityProperties());
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
                filterChain.doFilter(request, response);
                return;
            }

            boolean authenticated = authenticateSession(request) || authenticateApiToken(request);
            if (!authenticated && authSecurityProperties.isRequireAuthentication()) {
                String path = request.getRequestURI();
                if (!authSecurityProperties.isPublicPath(path)) {
                    writeUnauthorized(request, response);
                    return;
                }
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

    static String resolveAllowedCorsOrigin(String origin) {
        if (origin == null || origin.isBlank()) {
            return null;
        }
        String trimmed = origin.trim();
        for (Pattern pattern : ALLOWED_ORIGIN_PATTERNS) {
            if (pattern.matcher(trimmed).matches()) {
                return trimmed;
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

    private static void writeUnauthorized(HttpServletRequest request, HttpServletResponse response) throws IOException {
        applyCorsHeadersForUnauthorized(request, response);
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(
                "{\"code\":-1,\"msg\":\"" + UnauthorizedException.CODE + "\",\"data\":{\"errorCode\":\""
                        + UnauthorizedException.CODE + "\"}}"
        );
    }

    private static void applyCorsHeadersForUnauthorized(HttpServletRequest request, HttpServletResponse response) {
        String allowedOrigin = resolveAllowedCorsOrigin(request.getHeader(HttpHeaders.ORIGIN));
        if (allowedOrigin == null) {
            return;
        }
        response.setHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, allowedOrigin);
        response.setHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true");
        response.setHeader(HttpHeaders.VARY, HttpHeaders.ORIGIN);
        String requestHeaders = request.getHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS);
        if (requestHeaders != null && !requestHeaders.isBlank()) {
            response.setHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, requestHeaders);
        } else {
            response.setHeader(
                    HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS,
                    "Content-Type, " + SESSION_HEADER + ", " + API_TOKEN_HEADER + ", " + AUTHORIZATION_HEADER
            );
        }
    }
}
