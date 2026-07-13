package org.apache.datawise.backend.connector.yarn;

import org.apache.datawise.backend.connector.ConnectorCapability;
import org.apache.datawise.backend.connector.DataSourceConnector;
import org.apache.datawise.backend.connector.operation.ConnectorCatalogOperations;
import org.apache.datawise.backend.connector.operation.ConnectorClusterManagerOperations;
import org.apache.datawise.backend.connector.operation.ConnectorConnectionOperations;

import java.util.EnumSet;

public class YarnDataSourceConnector implements DataSourceConnector {

    private static final EnumSet<ConnectorCapability> CAPABILITIES = EnumSet.of(
            ConnectorCapability.CONNECTION_TEST,
            ConnectorCapability.CATALOG,
            ConnectorCapability.CLUSTER_MANAGER
    );

    private final YarnConnectorOperations yarn;

    public YarnDataSourceConnector(YarnConnectorOperations yarn) {
        this.yarn = yarn;
    }

    @Override
    public String id() {
        return "yarn";
    }

    @Override
    public int priority() {
        return 10;
    }

    @Override
    public boolean supports(String dbType) {
        return dbType != null && "yarn".equalsIgnoreCase(dbType);
    }

    @Override
    public EnumSet<ConnectorCapability> capabilities() {
        return EnumSet.copyOf(CAPABILITIES);
    }

    @Override
    public ConnectorConnectionOperations connection() {
        return yarn;
    }

    @Override
    public ConnectorCatalogOperations catalog() {
        return yarn;
    }

    @Override
    public ConnectorClusterManagerOperations clusterManager() {
        return yarn;
    }
}
