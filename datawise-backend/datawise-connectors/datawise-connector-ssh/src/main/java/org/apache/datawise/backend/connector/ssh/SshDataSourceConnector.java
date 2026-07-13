package org.apache.datawise.backend.connector.ssh;

import org.apache.datawise.backend.connector.ConnectorCapability;
import org.apache.datawise.backend.connector.DataSourceConnector;
import org.apache.datawise.backend.connector.operation.ConnectorCatalogOperations;
import org.apache.datawise.backend.connector.operation.ConnectorConnectionOperations;

import java.util.EnumSet;

public class SshDataSourceConnector implements DataSourceConnector {

    private static final EnumSet<ConnectorCapability> CAPABILITIES = EnumSet.of(
            ConnectorCapability.CONNECTION_TEST,
            ConnectorCapability.CATALOG,
            ConnectorCapability.REMOTE_SHELL
    );

    private final SshConnectorOperations ssh;

    public SshDataSourceConnector(SshConnectorOperations ssh) {
        this.ssh = ssh;
    }

    @Override
    public String id() {
        return "ssh";
    }

    @Override
    public int priority() {
        return 10;
    }

    @Override
    public boolean supports(String dbType) {
        return dbType != null && "ssh".equalsIgnoreCase(dbType);
    }

    @Override
    public EnumSet<ConnectorCapability> capabilities() {
        return EnumSet.copyOf(CAPABILITIES);
    }

    @Override
    public ConnectorConnectionOperations connection() {
        return ssh;
    }

    @Override
    public ConnectorCatalogOperations catalog() {
        return ssh;
    }
}
