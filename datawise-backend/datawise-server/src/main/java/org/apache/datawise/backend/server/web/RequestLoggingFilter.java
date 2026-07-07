package org.apache.datawise.backend.server.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Logs each HTTP request in a compact troubleshooting format. */
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger("datawise.api");
    private static final int MAX_BODY_LOG_CHARS = 2048;
    private static final Set<String> SENSITIVE_KEYS = Set.of(
            "password",
            "userpassword",
            "passwordhash",
            "sshpassword"
    );

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri != null && (uri.startsWith("/favicon.ico") || uri.startsWith("/actuator"));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        ContentCachingRequestWrapper wrapped = new ContentCachingRequestWrapper(request);
        long startedAt = System.currentTimeMillis();
        try {
            filterChain.doFilter(wrapped, response);
        } catch (Exception ex) {
            ExceptionLogging.error(log, "request.failed method=" + request.getMethod()
                    + " path=" + requestPath(request)
                    + " status=" + response.getStatus(), ex);
            throw ex;
        } finally {
            logRequest(wrapped, response, startedAt);
        }
    }

    private void logRequest(
            ContentCachingRequestWrapper request,
            HttpServletResponse response,
            long startedAt
    ) {
        if (!log.isInfoEnabled()) {
            return;
        }
        String method = request.getMethod();
        String url = requestPath(request);

        StringBuilder message = new StringBuilder();
        message.append("request method=").append(method);
        message.append(" path=").append(url);
        message.append(" status=").append(response.getStatus());
        message.append(" took=").append(System.currentTimeMillis() - startedAt).append("ms");

        String sessionId = request.getHeader(SessionAuthFilter.SESSION_HEADER);
        if (sessionId != null && !sessionId.isBlank()) {
            message.append(" session=").append(maskSessionId(sessionId.trim()));
        }

        Map<String, String[]> params = request.getParameterMap();
        if (!params.isEmpty()) {
            message.append(" params=").append(formatParams(params));
        }

        String bodyPreview = readBodyPreview(request);
        if (log.isDebugEnabled() && !bodyPreview.isBlank()) {
            message.append(" body=").append(bodyPreview);
        }

        log.info("{}", message);
    }

    private static String requestPath(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String query = request.getQueryString();
        return query == null || query.isBlank() ? uri : uri + "?" + query;
    }

    private static String formatParams(Map<String, String[]> params) {
        return params.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + formatParamValue(entry.getKey(), entry.getValue()))
                .collect(Collectors.joining("&"));
    }

    private static String formatParamValue(String key, String[] values) {
        if (values == null || values.length == 0) {
            return "";
        }
        if (isSensitiveKey(key)) {
            return "***";
        }
        if (values.length == 1) {
            return truncate(values[0], 256);
        }
        return truncate(String.join(",", values), 256);
    }

    private String readBodyPreview(ContentCachingRequestWrapper request) {
        byte[] content = request.getContentAsByteArray();
        if (content.length == 0) {
            return "";
        }
        String contentType = request.getContentType();
        if (contentType == null) {
            return "";
        }
        String normalized = contentType.toLowerCase();
        if (!normalized.contains("json")
                && !normalized.contains("xml")
                && !normalized.contains("text")
                && !normalized.contains("form-urlencoded")) {
            return "[binary " + content.length + " bytes]";
        }

        Charset charset = resolveCharset(request.getCharacterEncoding());
        String body = new String(content, charset);
        body = redactSensitiveJsonFields(body);
        return truncate(body.replaceAll("\\s+", " ").trim(), MAX_BODY_LOG_CHARS);
    }

    private static Charset resolveCharset(String encoding) {
        if (encoding == null || encoding.isBlank()) {
            return StandardCharsets.UTF_8;
        }
        try {
            return Charset.forName(encoding);
        } catch (Exception ex) {
            ExceptionLogging.recoverable(log, "resolveCharset fallback to UTF-8", ex);
            return StandardCharsets.UTF_8;
        }
    }

    private static String redactSensitiveJsonFields(String body) {
        String redacted = body;
        for (String key : SENSITIVE_KEYS) {
            redacted = redacted.replaceAll(
                    "(?i)\"" + key + "\"\\s*:\\s*\"[^\"]*\"",
                    "\"" + key + "\":\"***\""
            );
        }
        return redacted;
    }

    private static boolean isSensitiveKey(String key) {
        return key != null && SENSITIVE_KEYS.contains(key.toLowerCase());
    }

    private static String maskSessionId(String sessionId) {
        if (sessionId.length() <= 12) {
            return sessionId;
        }
        return sessionId.substring(0, 12) + "...";
    }

    private static String truncate(String value, int maxLen) {
        if (value == null) {
            return "";
        }
        if (value.length() <= maxLen) {
            return value;
        }
        return value.substring(0, maxLen) + "...";
    }
}
