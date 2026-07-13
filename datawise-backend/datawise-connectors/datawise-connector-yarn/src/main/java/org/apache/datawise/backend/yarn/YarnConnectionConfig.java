package org.apache.datawise.backend.yarn;

import org.apache.datawise.backend.model.ConnectionEntity;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Locale;

/** Connection settings for YARN Resource Manager REST API. */
public final class YarnConnectionConfig {

    private static final String DEFAULT_REST_PATH = "/ws/v1/cluster";

    private final String baseUrl;
    private final String authorizationHeader;

    private YarnConnectionConfig(String baseUrl, String authorizationHeader) {
        this.baseUrl = baseUrl;
        this.authorizationHeader = authorizationHeader;
    }

    public static YarnConnectionConfig from(ConnectionEntity entity) {
        String host = entity != null && entity.getHost() != null && !entity.getHost().isBlank()
                ? entity.getHost().trim()
                : "localhost";
        int port = parsePort(entity != null ? entity.getPort() : null, 8088);
        boolean useHttps = readBoolean(entity != null ? entity.getAdvancedConfig() : null, "useHttps", false);
        String restPath = readProperty(entity != null ? entity.getAdvancedConfig() : null, "restPath", DEFAULT_REST_PATH);
        if (!restPath.startsWith("/")) {
            restPath = "/" + restPath;
        }
        while (restPath.endsWith("/")) {
            restPath = restPath.substring(0, restPath.length() - 1);
        }
        String scheme = useHttps ? "https" : "http";
        String baseUrl = scheme + "://" + host + ":" + port + restPath;
        String authorizationHeader = basicAuthHeader(entity);
        return new YarnConnectionConfig(baseUrl, authorizationHeader);
    }

    public String baseUrl() {
        return baseUrl;
    }

    public String authorizationHeader() {
        return authorizationHeader;
    }

    private static String basicAuthHeader(ConnectionEntity entity) {
        if (entity == null) {
            return null;
        }
        String username = entity.getUsername();
        String password = entity.getPassword();
        if (username == null || username.isBlank() || password == null) {
            return null;
        }
        String token = username + ":" + password;
        return "Basic " + Base64.getEncoder().encodeToString(token.getBytes(StandardCharsets.UTF_8));
    }

    static int parsePort(String port, int defaultPort) {
        if (port == null || port.isBlank()) {
            return defaultPort;
        }
        try {
            return Integer.parseInt(port.trim());
        } catch (NumberFormatException ex) {
            return defaultPort;
        }
    }

    static boolean readBoolean(String advancedConfig, String key, boolean defaultValue) {
        String value = readProperty(advancedConfig, key, null);
        if (value == null) {
            return defaultValue;
        }
        return "true".equalsIgnoreCase(value.trim()) || "1".equals(value.trim());
    }

    static String readProperty(String advancedConfig, String key, String defaultValue) {
        if (advancedConfig == null || advancedConfig.isBlank() || key == null || key.isBlank()) {
            return defaultValue;
        }
        String prefix = key.toLowerCase(Locale.ROOT) + "=";
        for (String line : advancedConfig.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            if (trimmed.toLowerCase(Locale.ROOT).startsWith(prefix)) {
                String value = trimmed.substring(trimmed.indexOf('=') + 1).trim();
                return value.isEmpty() ? defaultValue : value;
            }
        }
        return defaultValue;
    }
}
