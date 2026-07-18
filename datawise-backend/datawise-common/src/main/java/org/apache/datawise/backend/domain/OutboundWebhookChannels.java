package org.apache.datawise.backend.domain;

/** Outbound notification channel kinds for tenant webhooks. */
public final class OutboundWebhookChannels {

    public static final String WEBHOOK = "webhook";
    public static final String FEISHU = "feishu";
    public static final String DINGTALK = "dingtalk";
    /** Create a GitHub Issue via Issues API (Insight / DQ / task failures → ticket). */
    public static final String GITHUB_ISSUE = "github_issue";
    /** Create a GitLab Issue via Issues API. */
    public static final String GITLAB_ISSUE = "gitlab_issue";

    private OutboundWebhookChannels() {
    }

    public static String normalize(String channel) {
        if (channel == null || channel.isBlank()) {
            return WEBHOOK;
        }
        String value = channel.trim().toLowerCase();
        return switch (value) {
            case FEISHU, "lark" -> FEISHU;
            case DINGTALK, "ding" -> DINGTALK;
            case GITHUB_ISSUE, "github", "gh_issue" -> GITHUB_ISSUE;
            case GITLAB_ISSUE, "gitlab", "gl_issue" -> GITLAB_ISSUE;
            case WEBHOOK, "generic", "http" -> WEBHOOK;
            default -> throw new IllegalArgumentException("unsupported outbound channel: " + channel);
        };
    }
}
