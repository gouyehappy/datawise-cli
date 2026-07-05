package org.apache.datawise.backend.connector.kafka;

import org.apache.datawise.backend.connector.ConnectorCapability;
import org.apache.datawise.backend.connector.DataSourceConnector;
import org.apache.datawise.backend.connector.operation.ConnectorCatalogOperations;
import org.apache.datawise.backend.connector.operation.ConnectorConnectionOperations;
import org.apache.datawise.backend.connector.operation.ConnectorMessageBrokerOperations;

import java.util.EnumSet;

public class KafkaDataSourceConnector implements DataSourceConnector {

    private static final EnumSet<ConnectorCapability> CAPABILITIES = EnumSet.of(
            ConnectorCapability.CONNECTION_TEST,
            ConnectorCapability.CATALOG,
            ConnectorCapability.MESSAGE_BROKER
    );

    private final KafkaConnectorOperations kafka;

    public KafkaDataSourceConnector(KafkaConnectorOperations kafka) {
        this.kafka = kafka;
    }

    @Override
    public String id() {
        return "kafka";
    }

    @Override
    public int priority() {
        return 10;
    }

    @Override
    public boolean supports(String dbType) {
        return dbType != null && "kafka".equalsIgnoreCase(dbType);
    }

    @Override
    public EnumSet<ConnectorCapability> capabilities() {
        return EnumSet.copyOf(CAPABILITIES);
    }

    @Override
    public ConnectorConnectionOperations connection() {
        return kafka;
    }

    @Override
    public ConnectorCatalogOperations catalog() {
        return kafka;
    }

    @Override
    public ConnectorMessageBrokerOperations messageBroker() {
        return kafka;
    }
}
