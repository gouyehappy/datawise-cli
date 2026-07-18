package org.apache.datawise.backend.connector;

import org.apache.datawise.backend.connector.hook.SqlExecutionHookRunner;
import org.apache.datawise.backend.connector.jdbc.JdbcConnectorOperations;
import org.apache.datawise.backend.connector.plugin.ConnectorPluginLoader;
import org.apache.datawise.backend.connector.plugin.ConnectorPluginRuntime;
import org.apache.datawise.backend.connector.spi.ConnectorPluginContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class ConnectorRegistryConfiguration {

    @Bean
    ConnectorRegistry connectorRegistry(
            List<DataSourceConnector> classpathConnectors,
            ConnectorPluginLoader pluginLoader,
            JdbcConnectorOperations jdbc,
            ConnectorPluginContributionHolder contributionHolder
    ) {
        ConnectorPluginContext context = new ConnectorPluginContext(jdbc);
        List<DataSourceConnector> pluginConnectors = pluginLoader.loadConnectors(context, contributionHolder);
        return ConnectorRegistry.merge(pluginConnectors, classpathConnectors);
    }

    @Bean
    SqlExecutionHookRunner sqlExecutionHookRunner(
            ConnectorRegistry connectorRegistry,
            ConnectorPluginLoader pluginLoader
    ) {
        return new SqlExecutionHookRunner(pluginLoader.loadedSqlExecutionHooks());
    }

    @Bean
    ConnectorPluginRuntime connectorPluginRuntime(
            ConnectorRegistry connectorRegistry,
            ConnectorPluginLoader pluginLoader,
            List<DataSourceConnector> classpathConnectors,
            JdbcConnectorOperations jdbc,
            ConnectorPluginContributionHolder contributionHolder,
            SqlExecutionHookRunner sqlExecutionHookRunner
    ) {
        return new ConnectorPluginRuntime(
                connectorRegistry,
                pluginLoader,
                classpathConnectors,
                jdbc,
                contributionHolder,
                sqlExecutionHookRunner
        );
    }
}
