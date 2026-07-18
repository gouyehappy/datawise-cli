package org.apache.datawise.backend.connector.plugin;

import org.apache.datawise.backend.connector.ConnectorPluginContributionHolder;
import org.apache.datawise.backend.connector.ConnectorRegistry;
import org.apache.datawise.backend.connector.DataSourceConnector;
import org.apache.datawise.backend.connector.hook.SqlExecutionHookRunner;
import org.apache.datawise.backend.connector.jdbc.JdbcConnectorOperations;
import org.apache.datawise.backend.connector.spi.ConnectorPluginContext;
import org.apache.datawise.backend.domain.ConnectorPluginReloadResultDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Reloads {@code config/plugins} JARs into the live {@link ConnectorRegistry} without a process restart.
 * <p>
 * Replacing an already-loaded JAR may still fail on Windows (file lock) until restart; new installs
 * typically hot-load cleanly.
 */
public class ConnectorPluginRuntime {

    private static final Logger log = LoggerFactory.getLogger(ConnectorPluginRuntime.class);

    private final ConnectorRegistry connectorRegistry;
    private final ConnectorPluginLoader pluginLoader;
    private final List<DataSourceConnector> classpathConnectors;
    private final JdbcConnectorOperations jdbc;
    private final ConnectorPluginContributionHolder contributionHolder;
    private final SqlExecutionHookRunner sqlExecutionHookRunner;

    public ConnectorPluginRuntime(
            ConnectorRegistry connectorRegistry,
            ConnectorPluginLoader pluginLoader,
            List<DataSourceConnector> classpathConnectors,
            JdbcConnectorOperations jdbc,
            ConnectorPluginContributionHolder contributionHolder,
            SqlExecutionHookRunner sqlExecutionHookRunner
    ) {
        this.connectorRegistry = connectorRegistry;
        this.pluginLoader = pluginLoader;
        this.classpathConnectors = classpathConnectors != null ? List.copyOf(classpathConnectors) : List.of();
        this.jdbc = jdbc;
        this.contributionHolder = contributionHolder;
        this.sqlExecutionHookRunner = sqlExecutionHookRunner;
    }

    public synchronized ConnectorPluginReloadResultDto reload() {
        ConnectorPluginContext context = new ConnectorPluginContext(jdbc);
        List<DataSourceConnector> pluginConnectors = pluginLoader.loadConnectors(context, contributionHolder);
        ConnectorRegistry merged = ConnectorRegistry.merge(pluginConnectors, classpathConnectors);
        connectorRegistry.replaceAll(merged.all());
        sqlExecutionHookRunner.replaceHooks(pluginLoader.loadedSqlExecutionHooks());
        List<String> ids = pluginLoader.loadedJarByConnectorId().keySet().stream().sorted().toList();
        log.info(
                "Hot-reloaded connector plugins: jars={}, connectors={}",
                pluginLoader.loadedPluginJarNames().size(),
                ids
        );
        return new ConnectorPluginReloadResultDto(
                pluginLoader.loadedPluginJarNames().size(),
                ids,
                pluginLoader.failedPluginLoads()
        );
    }
}
