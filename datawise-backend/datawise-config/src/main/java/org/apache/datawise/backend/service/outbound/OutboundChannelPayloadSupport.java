package org.apache.datawise.backend.service.outbound;

import org.apache.datawise.backend.domain.OutboundEvent;
import org.apache.datawise.backend.domain.OutboundWebhookChannels;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;

/**
 * Builds channel-specific HTTP bodies (generic webhook, Feishu, DingTalk, email gateway, GitHub/GitLab issues).
 */
final class OutboundChannelPayloadSupport {

    private static final int MAX_ISSUE_TITLE = 240;
    static final String MAIL_WEBHOOK_ENV = "DATAWISE_MAIL_WEBHOOK_URL";

    private static volatile Function<String, String> envLookup = System::getenv;

    private OutboundChannelPayloadSupport() {
    }

    /** Package-visible for tests. */
    static void setEnvLookupForTests(Function<String, String> lookup) {
        envLookup = lookup != null ? lookup : System::getenv;
    }

    static PreparedRequest prepare(
            String channel,
            String url,
            String secret,
            OutboundEvent event,
            Map<String, Object> genericPayload
    ) {
        String normalized = OutboundWebhookChannels.normalize(channel);
        return switch (normalized) {
            case OutboundWebhookChannels.FEISHU -> prepareFeishu(url, secret, event);
            case OutboundWebhookChannels.DINGTALK -> prepareDingtalk(url, secret, event);
            case OutboundWebhookChannels.EMAIL -> prepareEmail(url, secret, event);
            case OutboundWebhookChannels.GITHUB_ISSUE -> prepareGithubIssue(url, secret, event);
            case OutboundWebhookChannels.GITLAB_ISSUE -> prepareGitlabIssue(url, secret, event);
            default -> PreparedRequest.generic(url, genericPayload);
        };
    }

    private static PreparedRequest prepareFeishu(String url, String secret, OutboundEvent event) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("msg_type", "text");
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("text", formatPlainText(event));
        body.put("content", content);
        if (secret != null && !secret.isBlank()) {
            long timestampSec = System.currentTimeMillis() / 1000L;
            String sign = feishuSign(timestampSec, secret.trim());
            body.put("timestamp", String.valueOf(timestampSec));
            body.put("sign", sign);
        }
        return PreparedRequest.of(url, body, false, Map.of());
    }

    private static PreparedRequest prepareDingtalk(String url, String secret, OutboundEvent event) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("msgtype", "markdown");
        Map<String, Object> markdown = new LinkedHashMap<>();
        String title = issueTitle(event);
        markdown.put("title", title);
        markdown.put("text", formatMarkdown(event));
        body.put("markdown", markdown);

        String signedUrl = url;
        if (secret != null && !secret.isBlank()) {
            long timestampMs = System.currentTimeMillis();
            String sign = dingtalkSign(timestampMs, secret.trim());
            signedUrl = appendQuery(url, "timestamp", String.valueOf(timestampMs));
            signedUrl = appendQuery(signedUrl, "sign", sign);
        }
        return PreparedRequest.of(signedUrl, body, false, Map.of());
    }

    private static PreparedRequest prepareEmail(String url, String secret, OutboundEvent event) {
        EmailTarget target = resolveEmailTarget(url, secret, event);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("to", target.to());
        body.put("subject", issueTitle(event));
        body.put("text", formatPlainText(event));
        body.put("source", "datawise");
        if (event.type() != null && !event.type().isBlank()) {
            body.put("eventType", event.type());
        }
        if (event.id() != null && !event.id().isBlank()) {
            body.put("deliveryId", event.id());
        }
        Map<String, String> headers = new LinkedHashMap<>();
        if (target.apiKey() != null && !target.apiKey().isBlank()) {
            headers.put("Authorization", "Bearer " + target.apiKey());
        }
        return PreparedRequest.of(target.postUrl(), body, false, headers);
    }

    static EmailTarget resolveEmailTarget(String url, String secret, OutboundEvent event) {
        String trimmed = url != null ? url.trim() : "";
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("email channel requires a url (mailto:, recipient, or http gateway)");
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.startsWith("mailto:")) {
            String to = trimmed.substring("mailto:".length()).split("[?&]", 2)[0].trim();
            return new EmailTarget(requireMailWebhookUrl(), requireRecipient(to), apiKeyIfPresent(secret));
        }
        if (looksLikeEmail(trimmed) && !lower.startsWith("http://") && !lower.startsWith("https://")) {
            return new EmailTarget(requireMailWebhookUrl(), trimmed, apiKeyIfPresent(secret));
        }
        if (lower.startsWith("http://") || lower.startsWith("https://")) {
            String to = firstNonBlank(
                    emailFromSecret(secret),
                    emailFromEvent(event),
                    queryParam(trimmed, "to")
            );
            return new EmailTarget(trimmed, requireRecipient(to), apiKeyIfNotEmail(secret));
        }
        throw new IllegalArgumentException(
                "email channel url must be mailto:addr, a recipient address, or an http(s) mail gateway"
        );
    }

    private static String requireMailWebhookUrl() {
        String gateway = envLookup.apply(MAIL_WEBHOOK_ENV);
        if (gateway == null || gateway.isBlank()) {
            throw new IllegalArgumentException(
                    "email channel with mailto:/address URL requires " + MAIL_WEBHOOK_ENV
                            + " (HTTP mail gateway that accepts JSON {to,subject,text})"
            );
        }
        String trimmed = gateway.trim();
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            throw new IllegalArgumentException(MAIL_WEBHOOK_ENV + " must be an http(s) URL");
        }
        return trimmed;
    }

    private static String requireRecipient(String to) {
        if (to == null || to.isBlank() || !looksLikeEmail(to)) {
            throw new IllegalArgumentException(
                    "email channel requires a recipient (mailto:, bare address, secret=to@…, or data.emailTo)"
            );
        }
        return to.trim();
    }

    private static boolean looksLikeEmail(String value) {
        if (value == null) {
            return false;
        }
        String trimmed = value.trim();
        int at = trimmed.indexOf('@');
        return at > 0 && at < trimmed.length() - 1 && !trimmed.contains(" ") && !trimmed.contains("/");
    }

    private static String emailFromSecret(String secret) {
        if (secret != null && looksLikeEmail(secret)) {
            return secret.trim();
        }
        return null;
    }

    private static String apiKeyIfPresent(String secret) {
        if (secret == null || secret.isBlank() || looksLikeEmail(secret)) {
            return null;
        }
        return secret.trim();
    }

    private static String apiKeyIfNotEmail(String secret) {
        return apiKeyIfPresent(secret);
    }

    private static String emailFromEvent(OutboundEvent event) {
        if (event == null || event.data() == null) {
            return null;
        }
        Object value = event.data().get("emailTo");
        if (value == null) {
            value = event.data().get("to");
        }
        return value != null ? String.valueOf(value).trim() : null;
    }

    private static String queryParam(String url, String key) {
        int q = url.indexOf('?');
        if (q < 0 || q >= url.length() - 1) {
            return null;
        }
        String query = url.substring(q + 1);
        for (String part : query.split("&")) {
            String[] kv = part.split("=", 2);
            if (kv.length == 2 && key.equalsIgnoreCase(kv[0].trim())) {
                return URLDecoder.decode(kv[1].trim(), StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static PreparedRequest prepareGithubIssue(String url, String secret, OutboundEvent event) {
        requireToken(secret, "github_issue");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", issueTitle(event));
        body.put("body", formatIssueBody(event));
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Authorization", "Bearer " + secret.trim());
        headers.put("Accept", "application/vnd.github+json");
        headers.put("X-GitHub-Api-Version", "2022-11-28");
        return PreparedRequest.of(url, body, false, headers);
    }

    private static PreparedRequest prepareGitlabIssue(String url, String secret, OutboundEvent event) {
        requireToken(secret, "gitlab_issue");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", issueTitle(event));
        body.put("description", formatIssueBody(event));
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("PRIVATE-TOKEN", secret.trim());
        return PreparedRequest.of(url, body, false, headers);
    }

    private static void requireToken(String secret, String channel) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException(channel + " requires a personal access token in secret");
        }
    }

    static String issueTitle(OutboundEvent event) {
        String raw;
        if (event.title() != null && !event.title().isBlank()) {
            raw = event.title().trim();
        } else if (event.type() != null && !event.type().isBlank()) {
            raw = event.type().trim();
        } else {
            raw = "DataWise event";
        }
        Map<String, Object> data = event.data();
        if (data != null) {
            Object name = data.get("name");
            if (name != null && !String.valueOf(name).isBlank()) {
                raw = raw + ": " + name;
            }
        }
        if (raw.length() <= MAX_ISSUE_TITLE) {
            return raw;
        }
        return raw.substring(0, MAX_ISSUE_TITLE - 1) + "…";
    }

    static String formatIssueBody(OutboundEvent event) {
        StringBuilder sb = new StringBuilder();
        sb.append("_Opened by DataWise insight / ops export_\n\n");
        if (event.type() != null && !event.type().isBlank()) {
            sb.append("**Event:** `").append(event.type()).append("`\n\n");
        }
        if (event.id() != null && !event.id().isBlank()) {
            sb.append("**Delivery id:** `").append(event.id()).append("`\n\n");
        }
        if (event.body() != null && !event.body().isBlank()) {
            sb.append(event.body().trim()).append("\n\n");
        }
        Map<String, Object> data = event.data();
        if (data != null && !data.isEmpty()) {
            sb.append("### Details\n\n");
            for (Map.Entry<String, Object> entry : data.entrySet()) {
                if (entry.getKey() == null || entry.getValue() == null) {
                    continue;
                }
                String value = String.valueOf(entry.getValue()).trim();
                if (value.isEmpty()) {
                    continue;
                }
                if (value.length() > 800) {
                    value = value.substring(0, 797) + "...";
                }
                sb.append("- **").append(entry.getKey()).append(":** ").append(value).append('\n');
            }
            sb.append('\n');
        }
        sb.append("---\n");
        sb.append("Suggested next step: attach a runbook, open a follow-up PR, or link the owning Query Library item.\n");
        return sb.toString().trim();
    }

    static String formatPlainText(OutboundEvent event) {
        StringBuilder sb = new StringBuilder();
        sb.append('[').append(event.type() != null ? event.type() : "event").append("] ");
        if (event.title() != null && !event.title().isBlank()) {
            sb.append(event.title());
        }
        if (event.body() != null && !event.body().isBlank()) {
            sb.append('\n').append(event.body());
        }
        Map<String, Object> data = event.data();
        if (data != null && !data.isEmpty()) {
            Object name = data.get("name");
            if (name != null && !String.valueOf(name).isBlank()) {
                sb.append("\nname=").append(name);
            }
            Object message = data.get("message");
            if (message != null && !String.valueOf(message).isBlank()) {
                sb.append("\nmessage=").append(message);
            }
        }
        return sb.toString().trim();
    }

    static String formatMarkdown(OutboundEvent event) {
        StringBuilder sb = new StringBuilder();
        String title = event.title() != null && !event.title().isBlank() ? event.title() : event.type();
        sb.append("### ").append(title).append("\n\n");
        if (event.type() != null && !event.type().isBlank()) {
            sb.append("**type:** `").append(event.type()).append("`\n\n");
        }
        if (event.body() != null && !event.body().isBlank()) {
            sb.append(event.body()).append("\n\n");
        }
        Map<String, Object> data = event.data();
        if (data != null) {
            Object name = data.get("name");
            if (name != null && !String.valueOf(name).isBlank()) {
                sb.append("- name: ").append(name).append('\n');
            }
            Object message = data.get("message");
            if (message != null && !String.valueOf(message).isBlank()) {
                sb.append("- message: ").append(message).append('\n');
            }
        }
        return sb.toString().trim();
    }

    static String feishuSign(long timestampSec, String secret) {
        try {
            String stringToSign = timestampSec + "\n" + secret;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signData = mac.doFinal(stringToSign.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(signData);
        } catch (Exception ex) {
            throw new IllegalStateException("feishu sign failed", ex);
        }
    }

    static String dingtalkSign(long timestampMs, String secret) {
        try {
            String stringToSign = timestampMs + "\n" + secret;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signData = mac.doFinal(stringToSign.getBytes(StandardCharsets.UTF_8));
            return URLEncoder.encode(Base64.getEncoder().encodeToString(signData), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            throw new IllegalStateException("dingtalk sign failed", ex);
        }
    }

    private static String appendQuery(String url, String key, String value) {
        String encodedKey = URLEncoder.encode(key, StandardCharsets.UTF_8);
        String encodedValue = value != null ? value : "";
        if (!"sign".equals(key)) {
            encodedValue = URLEncoder.encode(encodedValue, StandardCharsets.UTF_8);
        }
        if (url.contains("?")) {
            return url + "&" + encodedKey + "=" + encodedValue;
        }
        return url + "?" + encodedKey + "=" + encodedValue;
    }

    record EmailTarget(String postUrl, String to, String apiKey) {
    }

    record PreparedRequest(
            String url,
            Map<String, Object> body,
            boolean applyDataWiseSignature,
            Map<String, String> extraHeaders
    ) {
        static PreparedRequest generic(String url, Map<String, Object> body) {
            return new PreparedRequest(url, body, true, Map.of());
        }

        static PreparedRequest of(
                String url,
                Map<String, Object> body,
                boolean applyDataWiseSignature,
                Map<String, String> extraHeaders
        ) {
            return new PreparedRequest(
                    url,
                    body,
                    applyDataWiseSignature,
                    extraHeaders != null ? extraHeaders : Map.of()
            );
        }
    }
}
