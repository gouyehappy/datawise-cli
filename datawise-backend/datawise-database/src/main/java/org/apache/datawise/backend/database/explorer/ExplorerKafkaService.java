package org.apache.datawise.backend.database.explorer;

import org.apache.datawise.backend.connector.facade.ConnectorFacade;
import org.apache.datawise.backend.database.context.ConnectionExecutionContext;
import org.apache.datawise.backend.domain.KafkaConsumerGroupMetricsDto;
import org.apache.datawise.backend.domain.KafkaConsumerGroupsResultDto;
import org.apache.datawise.backend.domain.KafkaMessagesResultDto;
import org.apache.datawise.backend.domain.KafkaProduceResultDto;
import org.apache.datawise.backend.domain.KafkaTopicDetailDto;
import org.apache.datawise.backend.domain.KafkaTopicsResultDto;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.springframework.stereotype.Service;

/**
 * Kafka-specific Explorer operations kept outside schema/tree orchestration.
 */
@Service
public class ExplorerKafkaService {

    private final ConnectionExecutionContext connectionContext;
    private final ConnectorFacade connectorFacade;

    public ExplorerKafkaService(
            ConnectionExecutionContext connectionContext,
            ConnectorFacade connectorFacade
    ) {
        this.connectionContext = connectionContext;
        this.connectorFacade = connectorFacade;
    }

    public KafkaTopicsResultDto listTopics(String connectionId, String pattern, Integer limit) {
        ConnectionEntity connection = requireAvailableExplorerConnection(connectionId);
        int pageSize = limit == null || limit <= 0 ? 200 : Math.min(limit, 500);
        return connectorFacade.messageBroker().listTopics(connection, pattern, pageSize);
    }

    public KafkaTopicDetailDto describeTopic(String connectionId, String topic) {
        ConnectionEntity connection = requireAvailableExplorerConnection(connectionId);
        return connectorFacade.messageBroker().describeTopic(connection, topic);
    }

    public KafkaMessagesResultDto consumeMessages(
            String connectionId,
            String topic,
            Integer partition,
            Long offset,
            Integer limit,
            Boolean fromBeginning
    ) {
        ConnectionEntity connection = requireAvailableExplorerConnection(connectionId);
        int pageSize = limit == null || limit <= 0 ? 20 : Math.min(limit, 100);
        boolean readFromBeginning = Boolean.TRUE.equals(fromBeginning);
        return connectorFacade.messageBroker().consumeMessages(
                connection, topic, partition, offset, pageSize, readFromBeginning
        );
    }

    public KafkaProduceResultDto produceMessage(
            String connectionId,
            String topic,
            String key,
            String value,
            Integer partition
    ) {
        ConnectionEntity connection = requireAvailableExplorerConnection(connectionId);
        return connectorFacade.messageBroker().produceMessage(
                connection, topic, key, value, partition
        );
    }

    public KafkaConsumerGroupsResultDto listConsumerGroups(
            String connectionId,
            String pattern,
            Integer limit
    ) {
        ConnectionEntity connection = requireAvailableExplorerConnection(connectionId);
        int pageSize = limit == null || limit <= 0 ? 200 : Math.min(limit, 500);
        return connectorFacade.messageBroker().listConsumerGroups(connection, pattern, pageSize);
    }

    public KafkaConsumerGroupMetricsDto describeConsumerGroupMetrics(
            String connectionId,
            String groupId,
            String topic
    ) {
        ConnectionEntity connection = requireAvailableExplorerConnection(connectionId);
        return connectorFacade.messageBroker().describeConsumerGroupMetrics(connection, groupId, topic);
    }

    private ConnectionEntity requireAvailableExplorerConnection(String connectionId) {
        return connectionContext.requireAvailableConnectionForCurrentUser(
                connectionId,
                ConnectionExecutionContext.EXPLORER_CONNECTION_NOT_FOUND
        ).entity();
    }
}
