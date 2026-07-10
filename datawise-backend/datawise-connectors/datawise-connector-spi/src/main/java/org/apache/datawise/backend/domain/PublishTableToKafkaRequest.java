package org.apache.datawise.backend.domain;

/**
 * Streams rows from a relational/document table to a Kafka topic (one row → one JSON message).
 */
public record PublishTableToKafkaRequest(
        String sourceConnectionId,
        String sourceDatabase,
        String tableName,
        String topic,
        String keyColumn,
        Integer maxMessages,
        Long intervalMs,
        Integer partition
) {
}
