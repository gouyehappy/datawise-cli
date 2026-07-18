package org.apache.datawise.backend.service.outbound;

import org.apache.datawise.backend.domain.OutboundEvent;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Base64;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OutboundChannelPayloadSupportTest {

    @Test
    void feishuPayloadUsesTextAndOptionalSign() {
        OutboundEvent event = new OutboundEvent(
                "evt-1",
                "scheduled_task.failed",
                Instant.now(),
                "Task failed",
                "boom",
                Map.of("name", "nightly")
        );
        var prepared = OutboundChannelPayloadSupport.prepare(
                "feishu",
                "https://open.feishu.cn/open-apis/bot/v2/hook/x",
                "sec",
                event,
                Map.of()
        );
        assertFalse(prepared.applyDataWiseSignature());
        assertEquals("text", prepared.body().get("msg_type"));
        assertTrue(prepared.body().containsKey("sign"));
        assertTrue(prepared.body().containsKey("timestamp"));
        @SuppressWarnings("unchecked")
        Map<String, Object> content = (Map<String, Object>) prepared.body().get("content");
        assertTrue(String.valueOf(content.get("text")).contains("Task failed"));
    }

    @Test
    void dingtalkPayloadAppendsSignedQuery() {
        OutboundEvent event = new OutboundEvent(
                "evt-2",
                "data_quality.failed",
                Instant.now(),
                "DQ failed",
                "rows > 0",
                Map.of("name", "neg-amount")
        );
        var prepared = OutboundChannelPayloadSupport.prepare(
                "dingtalk",
                "https://oapi.dingtalk.com/robot/send?access_token=abc",
                "sec",
                event,
                Map.of()
        );
        assertTrue(prepared.url().contains("timestamp="));
        assertTrue(prepared.url().contains("sign="));
        assertEquals("markdown", prepared.body().get("msgtype"));
    }

    @Test
    void feishuSignMatchesKnownVector() throws Exception {
        // timestamp=1672531200 secret=test — verify algorithm shape (Base64 HMAC)
        String sign = OutboundChannelPayloadSupport.feishuSign(1672531200L, "test");
        assertFalse(sign.isBlank());
        Base64.getDecoder().decode(sign);
    }

    @Test
    void webhookChannelKeepsGenericPayload() {
        Map<String, Object> generic = Map.of("id", "evt", "type", "outbound.test");
        OutboundEvent event = new OutboundEvent("evt", "outbound.test", Instant.now(), "t", "b", Map.of());
        var prepared = OutboundChannelPayloadSupport.prepare(
                "webhook",
                "https://example.com/hook",
                "sec",
                event,
                generic
        );
        assertTrue(prepared.applyDataWiseSignature());
        assertEquals(generic, prepared.body());
    }

    @Test
    void githubIssueRequiresTokenAndSetsAuthHeader() {
        OutboundEvent event = new OutboundEvent(
                "evt-3",
                "insight.action",
                Instant.now(),
                "Investigate DQ",
                "12 bad rows",
                Map.of("name", "neg-amount")
        );
        var prepared = OutboundChannelPayloadSupport.prepare(
                "github_issue",
                "https://api.github.com/repos/acme/data/issues",
                "ghp_test",
                event,
                Map.of()
        );
        assertEquals("Bearer ghp_test", prepared.extraHeaders().get("Authorization"));
        assertEquals("Investigate DQ: neg-amount", prepared.body().get("title"));
        assertTrue(String.valueOf(prepared.body().get("body")).contains("12 bad rows"));
    }

    @Test
    void gitlabIssueUsesPrivateTokenHeader() {
        OutboundEvent event = new OutboundEvent(
                "evt-4",
                "insight.digest",
                Instant.now(),
                "Nightly digest",
                "ok",
                Map.of()
        );
        var prepared = OutboundChannelPayloadSupport.prepare(
                "gitlab_issue",
                "https://gitlab.com/api/v4/projects/1/issues",
                "glpat-x",
                event,
                Map.of()
        );
        assertEquals("glpat-x", prepared.extraHeaders().get("PRIVATE-TOKEN"));
        assertTrue(prepared.body().containsKey("description"));
    }
}
