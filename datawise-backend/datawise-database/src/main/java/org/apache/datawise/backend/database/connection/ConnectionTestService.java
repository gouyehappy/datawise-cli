package org.apache.datawise.backend.database.connection;

import org.apache.datawise.backend.common.support.ConnectionProbeTargetPolicy;
import org.apache.datawise.backend.config.ConnectionProbeProperties;
import org.apache.datawise.backend.connector.facade.ConnectorFacade;
import org.apache.datawise.backend.domain.ConnectionConfig;
import org.apache.datawise.backend.domain.ConnectionTestResult;
import org.apache.datawise.backend.domain.DatasourceDefinitionDto;
import org.apache.datawise.backend.domain.JdbcDriverResolveRequest;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.connector.api.support.ConnectionMapper;
import org.apache.datawise.backend.jdbc.error.JdbcConnectionErrors;
import org.apache.datawise.backend.jdbc.ssh.SshTunnelException;
import org.apache.datawise.backend.jdbc.ssh.SshTunnelSupport;
import org.springframework.stereotype.Service;

import java.sql.SQLException;

@Service
public class ConnectionTestService {

    private final ConnectorFacade connectorFacade;
    private final DatasourceCatalogService datasourceCatalogService;
    private final JdbcDriverService jdbcDriverService;
    private final ConnectionProbeProperties probeProperties;

    public ConnectionTestService(
            ConnectorFacade connectorFacade,
            DatasourceCatalogService datasourceCatalogService,
            JdbcDriverService jdbcDriverService,
            ConnectionProbeProperties probeProperties
    ) {
        this.connectorFacade = connectorFacade;
        this.datasourceCatalogService = datasourceCatalogService;
        this.jdbcDriverService = jdbcDriverService;
        this.probeProperties = probeProperties;
    }

    public ConnectionTestResult test(ConnectionConfig config) {
        if (config.getHost() == null || config.getHost().isBlank()) {
            return new ConnectionTestResult(false, "Host is required", 0);
        }
        try {
            ConnectionProbeTargetPolicy.requireAllowedProbeHost(
                    config.getHost(),
                    "Host",
                    probeProperties.isAllowPrivateNetworks()
            );
        } catch (IllegalArgumentException ex) {
            return new ConnectionTestResult(false, ex.getMessage(), 0);
        }
        if (!"redis".equalsIgnoreCase(config.getDbType())
                && !"kafka".equalsIgnoreCase(config.getDbType())
                && config.getAuth() != null
                && !"NONE".equalsIgnoreCase(config.getAuth())
                && (config.getUser() == null || config.getUser().isBlank())) {
            return new ConnectionTestResult(false, "Username is required", 0);
        }

        if ("ssh".equalsIgnoreCase(config.getDbType())) {
            boolean hasPassword = config.getPassword() != null && !config.getPassword().isBlank();
            boolean hasKey = config.getSshPrivateKey() != null && !config.getSshPrivateKey().isBlank();
            if (!hasPassword && !hasKey) {
                return new ConnectionTestResult(false, "SSH password or private key is required", 0);
            }
        }

        DatasourceDefinitionDto datasource = datasourceCatalogService.findById(config.getDbType())
                .orElse(null);
        if (datasource == null) {
            return new ConnectionTestResult(false, "Datasource type is not available: " + config.getDbType(), 0);
        }

        applyDriverDefaults(config, datasource);
        ConnectionEntity probe = ConnectionMapper.fromDto(config, null, null, "probe");

        if (Boolean.TRUE.equals(config.getSshEnabled()) && !"ssh".equalsIgnoreCase(config.getDbType())) {
            try {
                SshTunnelSupport.validate(probe);
            } catch (SshTunnelException ex) {
                return new ConnectionTestResult(false, ex.getMessage(), 0);
            }
        }

        try {
            if (Boolean.TRUE.equals(config.getSshEnabled())
                    && !"ssh".equalsIgnoreCase(config.getDbType())
                    && config.getSshHost() != null
                    && !config.getSshHost().isBlank()) {
                ConnectionProbeTargetPolicy.requireAllowedProbeHost(
                        config.getSshHost(),
                        "SSH host",
                        probeProperties.isAllowPrivateNetworks()
                );
            }
        } catch (IllegalArgumentException ex) {
            return new ConnectionTestResult(false, ex.getMessage(), 0);
        }

        if (datasource.jdbcDriverRequired()) {
            try {
                ensureJdbcDriver(probe);
            } catch (SQLException ex) {
                return new ConnectionTestResult(false, JdbcConnectionErrors.toUserMessage(probe, ex), 0);
            }
        }

        return connectorFacade.catalog().testConnection(probe);
    }

    private void applyDriverDefaults(ConnectionConfig config, DatasourceDefinitionDto datasource) {
        if (!datasource.jdbcDriverRequired()) {
            return;
        }
        if (config.getDriver() == null || config.getDriver().isBlank()) {
            config.setDriver(datasource.defaultDriverMaven());
        }
        if (config.getDriverClass() == null || config.getDriverClass().isBlank()) {
            config.setDriverClass(datasource.defaultDriverClass());
        }
    }

    private void ensureJdbcDriver(ConnectionEntity entity) throws SQLException {
        if (entity.getDriver() == null || entity.getDriver().isBlank()) {
            throw new SQLException("JDBC driver Maven coordinates are required");
        }
        if (entity.getDriverClass() == null || entity.getDriverClass().isBlank()) {
            throw new SQLException("JDBC driver class is required");
        }
        jdbcDriverService.resolve(new JdbcDriverResolveRequest(entity.getDriver(), entity.getDriverClass()));
    }
}
