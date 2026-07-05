package org.apache.datawise.backend.connector.facade.messagebroker;

import org.apache.datawise.backend.connector.facade.catalog.ConnectorCatalogAccess;
import org.apache.datawise.backend.domain.KafkaConsumerGroupMetricsDto;
import org.apache.datawise.backend.domain.KafkaConsumerGroupsResultDto;
import org.apache.datawise.backend.domain.KafkaMessagesResultDto;
import org.apache.datawise.backend.domain.KafkaProduceResultDto;
import org.apache.datawise.backend.domain.KafkaTopicDetailDto;
import org.apache.datawise.backend.domain.KafkaTopicsResultDto;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.springframework.stereotype.Component;

/** Kafka 等消息队列能力入口。 */
@Component
public class ConnectorMessageBrokerAccess {

    private final ConnectorCatalogAccess catalog;

    public ConnectorMessageBrokerAccess(ConnectorCatalogAccess catalog) {
        this.catalog = catalog;
    }

    public KafkaTopicsResultDto listTopics(ConnectionEntity connection, String pattern, int limit) {
        return catalog.resolve(connection).messageBroker().listTopics(connection, pattern, limit);
    }

    public KafkaTopicDetailDto describeTopic(ConnectionEntity connection, String topic) {
        return catalog.resolve(connection).messageBroker().describeTopic(connection, topic);
    }

    public KafkaMessagesResultDto consumeMessages(
            ConnectionEntity connection,
            String topic,
            Integer partition,
            Long offset,
            int limit,
            boolean fromBeginning
    ) {
        return catalog.resolve(connection).messageBroker().consumeMessages(
                connection, topic, partition, offset, limit, fromBeginning
        );
    }

    public KafkaProduceResultDto produceMessage(
            ConnectionEntity connection,
            String topic,
            String key,
            String value,
            Integer partition
    ) {
        return catalog.resolve(connection).messageBroker().produceMessage(
                connection, topic, key, value, partition
        );
    }

    public KafkaConsumerGroupsResultDto listConsumerGroups(
            ConnectionEntity connection,
            String pattern,
            int limit
    ) {
        return catalog.resolve(connection).messageBroker().listConsumerGroups(connection, pattern, limit);
    }

    public KafkaConsumerGroupMetricsDto describeConsumerGroupMetrics(
            ConnectionEntity connection,
            String groupId,
            String topic
    ) {
        return catalog.resolve(connection).messageBroker().describeConsumerGroupMetrics(connection, groupId, topic);
    }
}
