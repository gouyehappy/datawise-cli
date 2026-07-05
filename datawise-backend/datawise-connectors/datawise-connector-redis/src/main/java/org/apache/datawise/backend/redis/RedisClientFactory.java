package org.apache.datawise.backend.redis;

import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import org.apache.datawise.backend.model.ConnectionEntity;

import java.time.Duration;

/** Creates Lettuce connections from {@link ConnectionEntity}. */
public final class RedisClientFactory {

    private RedisClientFactory() {
    }

    public static StatefulRedisConnection<String, String> open(ConnectionEntity entity) {
        RedisURI uri = RedisURI.builder()
                .withHost(entity.getHost())
                .withPort(parsePort(entity.getPort()))
                .withDatabase(parseDb(entity.getDatabaseName()))
                .withTimeout(Duration.ofSeconds(5))
                .build();
        if (entity.getUsername() != null && !entity.getUsername().isBlank()) {
            uri.setUsername(entity.getUsername());
        }
        if (entity.getPassword() != null && !entity.getPassword().isBlank()) {
            uri.setPassword(entity.getPassword().toCharArray());
        }
        RedisClient client = RedisClient.create(uri);
        return client.connect();
    }

    static int parsePort(String port) {
        if (port == null || port.isBlank()) {
            return 6379;
        }
        try {
            return Integer.parseInt(port.trim());
        } catch (NumberFormatException ex) {
            return 6379;
        }
    }

    static int parseDb(String databaseName) {
        if (databaseName == null || databaseName.isBlank()) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(databaseName.trim()));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }
}
