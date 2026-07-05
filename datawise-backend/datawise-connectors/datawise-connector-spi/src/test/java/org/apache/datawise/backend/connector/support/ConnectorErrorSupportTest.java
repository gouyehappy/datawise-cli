package org.apache.datawise.backend.connector.support;

import org.apache.datawise.backend.model.ConnectionEntity;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ConnectorErrorSupportTest {

    @Test
    void redisAuthFailureUsesTemplateHint() {
        ConnectionEntity entity = new ConnectionEntity();
        entity.setHost("127.0.0.1");
        entity.setPort("6379");

        String message = ConnectorErrorSupport.toUserMessage(
                entity,
                new RuntimeException("NOAUTH Authentication required"),
                ConnectorErrorTemplate.redis()
        );

        assertTrue(message.contains("Redis authentication failed"));
        assertTrue(message.contains("127.0.0.1:6379"));
    }
}
