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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PreDestroy;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Enumeration;
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
    private final boolean loadPlugins;
    private final ClassLoader applicationClassLoader;
    private final List<LoadedPlugin> loadedPlugins = new ArrayList<>();
    private final List<SqlExecutionHook> loadedSqlExecutionHooks = new ArrayList<>();
    private final List<ConnectorPluginLoadFailure> failedPlugins = new ArrayList<>();

    /** Programmatic / test construction (plugins enabled). */
    public ConnectorPluginLoader(String configDir, String pluginsDirName) throws IOException {
        this(configDir, pluginsDirName, true);
    }

    @Autowired
    public ConnectorPluginLoader(
            @Value("${datawise.config.dir:config}") String configDir,
            @Value("${datawise.connectors.plugins-dir:plugins}") String pluginsDirName,
            @Value("${datawise.connectors.load-plugins:true}") boolean loadPlugins
    ) throws IOException {
        Path configRoot = ConfigDirectoryLocator.resolve(configDir);
        String dirName = pluginsDirName != null && !pluginsDirName.isBlank() ? pluginsDirName.trim() : "plugins";
        this.pluginsDir = configRoot.resolve(dirName).toAbsolutePath().normalize();
        this.loadPlugins = loadPlugins;
        this.applicationClassLoader = ConnectorPluginLoader.class.getClassLoader();
        Files.createDirectories(pluginsDir);
        log.info("Connector plugins directory: {} (loadPlugins={})", pluginsDir, loadPlugins);
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
        if (!loadPlugins) {
            contributionHolder.setContributions(ConnectorDialectContributions.EMPTY);
            log.info("Connector plugin loading disabled (datawise.connectors.load-plugins=false)");
            return connectors;
        }
        for (Path jarPath : listPluginJars()) {
            contributions = loadJar(jarPath, context, connectors, contributions);
        }
        contributionHolder.setContributions(contributions);
        if (!connectors.isEmpty()) {
            List<String> ids = connectors.stream()
                    .map(DataSourceConnector::id)
                    .distinct()
                    .sorted()
                    .toList();
            log.info("Loaded {} connector plugin(s) from {}: {}", ids.size(), pluginsDir, ids);
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
                // ServiceLoader can surface parent-classpath providers; only accept ones whose
                // META-INF/services entry (or defining CL) belongs to this plugin JAR.
                if (!isContributedByPluginJar(
                        DataSourceConnectorProvider.class, provider, pluginClassLoader)) {
                    log.debug(
                            "Skipping classpath SPI provider {} while loading {}",
                            provider.getClass().getName(),
                            jarName
                    );
                    continue;
                }
                DataSourceConnector connector = provider.create(context);
                String connectorId = connector.id();
                boolean duplicateInJar = jarConnectors.stream().anyMatch(existing -> existing.id().equals(connectorId));
                boolean alreadyLoaded = connectors.stream().anyMatch(existing -> existing.id().equals(connectorId));
                if (duplicateInJar || alreadyLoaded) {
                    log.debug("Skipping duplicate connector id {} from {}", connectorId, jarName);
                    continue;
                }
                jarConnectors.add(connector);
                jarContributions = jarContributions.merge(provider.dialectContributions());
            }
            for (SqlExecutionHook hook : ServiceLoader.load(SqlExecutionHook.class, pluginClassLoader)) {
                if (!isContributedByPluginJar(SqlExecutionHook.class, hook, pluginClassLoader)) {
                    continue;
                }
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

    /**
     * Whether this SPI instance is contributed by {@code pluginClassLoader}'s own JAR.
     * <p>
     * Parent-first {@link URLClassLoader} may resolve the implementation class from the app
     * classpath (e.g. {@code datawise-connector-ssh} on the server) even when
     * {@code META-INF/services/…} lives only in the plugin JAR. Matching the service resource
     * URL to this JAR (not only {@code getClassLoader()}) avoids false negatives that drop SSH.
     */
    static boolean isContributedByPluginJar(
            Class<?> serviceType,
            Object spiInstance,
            URLClassLoader pluginClassLoader
    ) {
        if (serviceType == null || spiInstance == null || pluginClassLoader == null) {
            return false;
        }
        if (spiInstance.getClass().getClassLoader() == pluginClassLoader) {
            return true;
        }
        URL[] urls = pluginClassLoader.getURLs();
        if (urls.length == 0) {
            return false;
        }
        String pluginJar = urls[0].toExternalForm();
        String resourceName = "META-INF/services/" + serviceType.getName();
        String providerName = spiInstance.getClass().getName();
        try {
            Enumeration<URL> resources = pluginClassLoader.getResources(resourceName);
            while (resources.hasMoreElements()) {
                URL resource = resources.nextElement();
                String resourceUrl = resource.toExternalForm();
                if (!resourceUrl.startsWith("jar:" + pluginJar + "!")) {
                    continue;
                }
                if (serviceFileListsProvider(resource, providerName)) {
                    return true;
                }
            }
        } catch (IOException ignored) {
            return false;
        }
        return false;
    }

    private static boolean serviceFileListsProvider(URL serviceResource, String providerClassName)
            throws IOException {
        try (InputStream in = serviceResource.openStream();
             BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                if (trimmed.equals(providerClassName)) {
                    return true;
                }
            }
        }
        return false;
    }

    private record LoadedPlugin(Path jarPath, URLClassLoader classLoader) {
    }
}
