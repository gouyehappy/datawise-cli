package org.apache.datawise.backend.domain;

public record KafkaTopicPartitionDto(
        int partition,
        long beginningOffset,
        long endOffset
) {
}
