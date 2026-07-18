package org.apache.datawise.backend.platform.schedule;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Generic HTTP call used by {@code http_trigger} scheduled tasks (Airflow / dbt Cloud / Flink REST, etc.).
 */
final class OrchestrationHttpSupport {

    private OrchestrationHttpSupport() {
    }

    static Result execute(JsonNode payload, ObjectMapper objectMapper, HttpClient httpClient) throws Exception {
        String url = text(payload, "url");
        URI uri = URI.create(url);
        String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase(Locale.ROOT) : "";
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            throw new IllegalArgumentException("url must be http or https");
        }

        String method = payload.has("method") && !payload.get("method").isNull()
                ? payload.get("method").asText("POST").trim().toUpperCase(Locale.ROOT)
                : "POST";
        if (!method.equals("POST") && !method.equals("PUT") && !method.equals("PATCH") && !method.equals("GET")) {
            throw new IllegalArgumentException("unsupported HTTP method: " + method);
        }

        int timeoutMs = payload.has("timeoutMs") ? payload.get("timeoutMs").asInt(10000) : 10000;
        timeoutMs = Math.max(1000, Math.min(timeoutMs, 60000));
        int statusMin = payload.has("successStatusMin") ? payload.get("successStatusMin").asInt(200) : 200;
        int statusMax = payload.has("successStatusMax") ? payload.get("successStatusMax").asInt(299) : 299;

        String body = null;
        if (payload.has("bodyJson") && !payload.get("bodyJson").isNull()) {
            JsonNode bodyNode = payload.get("bodyJson");
            body = bodyNode.isTextual() ? bodyNode.asText() : objectMapper.writeValueAsString(bodyNode);
        } else if (payload.has("body") && !payload.get("body").isNull()) {
            body = payload.get("body").asText("");
        }

        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofMillis(timeoutMs))
                .header("User-Agent", "DataWise-Orchestration/1.0");

        Map<String, String> headers = readHeaders(payload.get("headers"));
        boolean hasContentType = false;
        for (Map.Entry<String, String> header : headers.entrySet()) {
            builder.header(header.getKey(), header.getValue());
            if ("content-type".equalsIgnoreCase(header.getKey())) {
                hasContentType = true;
            }
        }

        if ("GET".equals(method)) {
            builder.GET();
        } else {
            byte[] bytes = body != null ? body.getBytes(StandardCharsets.UTF_8) : new byte[0];
            if (!hasContentType && bytes.length > 0) {
                builder.header("Content-Type", "application/json; charset=utf-8");
            }
            builder.method(method, HttpRequest.BodyPublishers.ofByteArray(bytes));
        }

        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        int status = response.statusCode();
        String responseBody = response.body() != null ? response.body() : "";
        if (status < statusMin || status > statusMax) {
            throw new IllegalArgumentException(
                    "HTTP " + status + " outside " + statusMin + "-" + statusMax
                            + (responseBody.isBlank() ? "" : ": " + clip(responseBody, 240))
            );
        }
        return new Result(status, clip(responseBody, 500), method, url);
    }

    private static Map<String, String> readHeaders(JsonNode node) {
        Map<String, String> headers = new LinkedHashMap<>();
        if (node == null || !node.isObject()) {
            return headers;
        }
        Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            if (entry.getKey() == null || entry.getKey().isBlank() || entry.getValue() == null || entry.getValue().isNull()) {
                continue;
            }
            headers.put(entry.getKey().trim(), entry.getValue().asText(""));
        }
        return headers;
    }

    private static String text(JsonNode node, String field) {
        if (!node.has(field) || node.get(field).isNull()) {
            throw new IllegalArgumentException(field + " is required in payload");
        }
        String value = node.get(field).asText("").trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException(field + " is required in payload");
        }
        return value;
    }

    private static String clip(String value, int max) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= max) {
            return trimmed;
        }
        return trimmed.substring(0, Math.max(0, max - 3)) + "...";
    }

    record Result(int statusCode, String bodyPreview, String method, String url) {
    }
}
