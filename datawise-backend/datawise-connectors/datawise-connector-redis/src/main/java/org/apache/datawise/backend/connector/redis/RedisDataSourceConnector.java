package org.apache.datawise.backend.connector.redis;

import org.apache.datawise.backend.connector.ConnectorCapability;
import org.apache.datawise.backend.connector.DataSourceConnector;
import org.apache.datawise.backend.connector.operation.ConnectorCatalogOperations;
import org.apache.datawise.backend.connector.operation.ConnectorConnectionOperations;
import org.apache.datawise.backend.connector.operation.ConnectorKeyValueOperations;
import org.apache.datawise.backend.connector.operation.ConnectorNativeCommandOperations;

import java.util.EnumSet;
import java.util.Locale;

public class RedisDataSourceConnector implements DataSourceConnector {

    private static final EnumSet<ConnectorCapability> CAPABILITIES = EnumSet.of(
            ConnectorCapability.CONNECTION_TEST,
            ConnectorCapability.CATALOG,
            ConnectorCapability.NATIVE_COMMAND,
            ConnectorCapability.KEY_VALUE
    );

    private final RedisConnectorOperations redis;

    public RedisDataSourceConnector(RedisConnectorOperations redis) {
        this.redis = redis;
    }

    @Override
    public String id() {
        return "redis";
    }

    @Override
    public int priority() {
        return 10;
    }

    @Override
    public boolean supports(String dbType) {
        return dbType != null && "redis".equalsIgnoreCase(dbType);
    }

    @Override
    public EnumSet<ConnectorCapability> capabilities() {
        return EnumSet.copyOf(CAPABILITIES);
    }

    @Override
    public ConnectorConnectionOperations connection() {
        return redis;
    }

    @Override
    public ConnectorCatalogOperations catalog() {
        return redis;
    }

    @Override
    public ConnectorNativeCommandOperations nativeCommand() {
        return redis;
    }

    @Override
    public ConnectorKeyValueOperations keyValue() {
        return redis;
    }
}
