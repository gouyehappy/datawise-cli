package org.apache.datawise.backend.connector.facade.catalog;

import org.apache.datawise.backend.connector.ConnectorRegistry;
import org.apache.datawise.backend.connector.DataSourceConnector;
import org.apache.datawise.backend.connector.catalog.SchemaSession;
import org.apache.datawise.backend.connector.plugin.ConnectorPluginLoader;
import org.apache.datawise.backend.domain.ConnectionTestResult;
import org.apache.datawise.backend.domain.ConnectorPluginLoadFailure;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.springframework.stereotype.Component;

import java.sql.SQLException;
import java.util.List;

/** 连接器解析与 Catalog / 连接测试能力入口。 */
@Component
public class ConnectorCatalogAccess {

    private final ConnectorRegistry connectorRegistry;
    private final ConnectorPluginLoader pluginLoader;

    public ConnectorCatalogAccess(ConnectorRegistry connectorRegistry, ConnectorPluginLoader pluginLoader) {
        this.connectorRegistry = connectorRegistry;
        this.pluginLoader = pluginLoader;
    }

    public DataSourceConnector resolve(ConnectionEntity entity) {
        return connectorRegistry.resolve(entity);
    }

    public DataSourceConnector resolve(String dbType) {
        return connectorRegistry.resolve(dbType);
    }

    public boolean supports(String dbType) {
        try {
            return connectorRegistry.resolve(dbType).supports(dbType);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    public List<TreeNode> loadConnectionRoot(ConnectionEntity connection, String pattern) {
        return resolve(connection).catalog().loadConnectionRoot(connection, pattern);
    }

    public boolean supportsSchemaTree(ConnectionEntity connection) {
        return resolve(connection).catalog().supportsSchemaTree();
    }

    public SchemaSession openSchemaSession(ConnectionEntity connection) throws SQLException {
        return resolve(connection).catalog().openSchemaSession(connection);
    }

    public ConnectionTestResult testConnection(ConnectionEntity entity) {
        return resolve(entity).connection().test(entity);
    }

    public ConnectionTestResult pingConnection(ConnectionEntity entity) {
        return resolve(entity).connection().ping(entity);
    }

    public List<String> loadedPluginJarNames() {
        return pluginLoader.loadedPluginJarNames();
    }

    public List<ConnectorPluginLoadFailure> failedPluginLoads() {
        return pluginLoader.failedPluginLoads();
    }
}
