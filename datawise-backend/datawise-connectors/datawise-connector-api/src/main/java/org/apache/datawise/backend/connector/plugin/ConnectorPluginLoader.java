package org.apache.datawise.backend.connector.plugin;

import org.apache.datawise.backend.connector.ConnectorPluginContributionHolder;
import org.apache.datawise.backend.connector.DataSourceConnector;
import org.apache.datawise.backend.connector.spi.ConnectorDialectContributions;
import org.apache.datawise.backend.connector.spi.ConnectorPluginContext;
import org.apache.datawise.backend.connector.spi.DataSourceConnectorProvider;
import org.apache.datawise.backend.connector.spi.SqlExecutionHook;
import org.apache.datawise.backend.domain.ConnectorPluginLoadFailure;
import org.apache.datawise.backend.common.support.ConfigDirectoryLocator;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.ServiceConfigurationError;
import java.util.ServiceLoader;

/**
 * Loads optional datasource connector plugins from {@code {configDir}/plugins/*.jar}.
 */
@Component
public class ConnectorPluginLoader {

    private static final Logger log = LoggerFactory.getLogger(ConnectorPluginLoader.class);
    private static final String NO_SPI_PROVIDERS = "NO_SPI_PROVIDERS";

    private final Path pluginsDir;
    private final ClassLoader applicationClassLoader;
    private final List<LoadedPlugin> loadedPlugins = new ArrayList<>();
    private final List<SqlExecutionHook> loadedSqlExecutionHooks = new ArrayList<>();
    private final List<ConnectorPluginLoadFailure> failedPlugins = new ArrayList<>();

    public ConnectorPluginLoader(
            @Value("${datawise.config.dir:config}") String configDir,
            @Value("${datawise.connectors.plugins-dir:plugins}") String pluginsDirName
    ) throws IOException {
        Path configRoot = ConfigDirectoryLocator.resolve(configDir);
        String dirName = pluginsDirName != null && !pluginsDirName.isBlank() ? pluginsDirName.trim() : "plugins";
        this.pluginsDir = configRoot.resolve(dirName).toAbsolutePath().normalize();
        this.applicationClassLoader = ConnectorPluginLoader.class.getClassLoader();
        Files.createDirectories(pluginsDir);
        log.info("Connector plugins directory: {}", pluginsDir);
    }

    public Path pluginsDirectory() {
        return pluginsDir;
    }

    public List<String> loadedPluginJarNames() {
        return loadedPlugins.stream()
                .map(plugin -> plugin.jarPath().getFileName().toString())
                .sorted()
                .toList();
    }

    public List<ConnectorPluginLoadFailure> failedPluginLoads() {
        return List.copyOf(failedPlugins);
    }

    public List<SqlExecutionHook> loadedSqlExecutionHooks() {
        return List.copyOf(loadedSqlExecutionHooks);
    }

    public List<DataSourceConnector> loadConnectors(
            ConnectorPluginContext context,
            ConnectorPluginContributionHolder contributionHolder
    ) {
        closeLoadedPlugins();
        failedPlugins.clear();
        loadedSqlExecutionHooks.clear();
        List<DataSourceConnector> connectors = new ArrayList<>();
        ConnectorDialectContributions contributions = ConnectorDialectContributions.EMPTY;
        for (Path jarPath : listPluginJars()) {
            contributions = loadJar(jarPath, context, connectors, contributions);
        }
        contributionHolder.setContributions(contributions);
        if (!connectors.isEmpty()) {
            log.info(
                    "Loaded {} connector plugin(s) from {}: {}",
                    connectors.size(),
                    pluginsDir,
                    connectors.stream().map(DataSourceConnector::id).sorted().toList()
            );
        }
        if (!failedPlugins.isEmpty()) {
            log.warn("Connector plugin load failures: {}", failedPlugins);
        }
        return connectors;
    }

    @PreDestroy
    public void closeAll() {
        closeLoadedPlugins();
    }

    private ConnectorDialectContributions loadJar(
            Path jarPath,
            ConnectorPluginContext context,
            List<DataSourceConnector> connectors,
            ConnectorDialectContributions accumulated
    ) {
        String jarName = jarPath.getFileName().toString();
        URLClassLoader pluginClassLoader = null;
        try {
            pluginClassLoader = new URLClassLoader(
                    new URL[]{jarPath.toUri().toURL()},
                    applicationClassLoader
            );
            ServiceLoader<DataSourceConnectorProvider> providers = ServiceLoader.load(
                    DataSourceConnectorProvider.class,
                    pluginClassLoader
            );
            // 整 JAR 事务式加载：先收集到局部，全部成功后再对外发布，
            // 避免部分 provider 失败时注册表持有背后 classloader 已关闭的实例
            List<DataSourceConnector> jarConnectors = new ArrayList<>();
            List<SqlExecutionHook> jarHooks = new ArrayList<>();
            ConnectorDialectContributions jarContributions = ConnectorDialectContributions.EMPTY;
            for (DataSourceConnectorProvider provider : providers) {
                DataSourceConnector connector = provider.create(context);
                jarConnectors.add(connector);
                jarContributions = jarContributions.merge(provider.dialectContributions());
            }
            for (SqlExecutionHook hook : ServiceLoader.load(SqlExecutionHook.class, pluginClassLoader)) {
                jarHooks.add(hook);
            }
            if (jarConnectors.isEmpty()) {
                log.warn("Connector plugin jar has no SPI providers: {}", jarName);
                recordFailure(jarName, NO_SPI_PROVIDERS);
                closeQuietly(pluginClassLoader);
                return accumulated;
            }
            connectors.addAll(jarConnectors);
            loadedSqlExecutionHooks.addAll(jarHooks);
            loadedPlugins.add(new LoadedPlugin(jarPath, pluginClassLoader));
            jarConnectors.forEach(connector ->
                    log.info("Registered connector plugin {} from {}", connector.id(), jarName));
            jarHooks.forEach(hook ->
                    log.info("Registered SQL execution hook {} from {}", hook.id(), jarName));
            return accumulated.merge(jarContributions);
        } catch (Exception | LinkageError | ServiceConfigurationError ex) {
            // ServiceLoader 对缺类插件抛 Error（如 NoClassDefFoundError）；单个坏插件不得阻断启动
            closeQuietly(pluginClassLoader);
            ExceptionLogging.warn(log, "Failed to load connector plugin " + jarName, ex);
            recordFailure(jarName, ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName());
            return accumulated;
        }
    }

    private void recordFailure(String jarName, String reason) {
        failedPlugins.add(new ConnectorPluginLoadFailure(jarName, reason));
    }

    private List<Path> listPluginJars() {
        if (!Files.isDirectory(pluginsDir)) {
            return List.of();
        }
        try (var stream = Files.list(pluginsDir)) {
            return stream.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase().endsWith(".jar"))
                    .sorted()
                    .toList();
        } catch (IOException ex) {
            ExceptionLogging.warn(log, "Failed to list connector plugins in " + pluginsDir, ex);
            return List.of();
        }
    }

    private void closeLoadedPlugins() {
        for (LoadedPlugin plugin : loadedPlugins) {
            closeQuietly(plugin.classLoader());
        }
        loadedPlugins.clear();
        loadedSqlExecutionHooks.clear();
    }

    private static void closeQuietly(URLClassLoader classLoader) {
        if (classLoader == null) {
            return;
        }
        try {
            classLoader.close();
        } catch (IOException ex) {
            ExceptionLogging.recoverable(log, "Failed to close connector plugin classloader", ex);
        }
    }

    private record LoadedPlugin(Path jarPath, URLClassLoader classLoader) {
    }
}
