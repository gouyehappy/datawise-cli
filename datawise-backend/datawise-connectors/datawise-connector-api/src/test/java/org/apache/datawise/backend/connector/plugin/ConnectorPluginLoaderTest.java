package org.apache.datawise.backend.connector.plugin;

import org.apache.datawise.backend.connector.ConnectorPluginContributionHolder;
import org.apache.datawise.backend.connector.DataSourceConnector;
import org.apache.datawise.backend.connector.jdbc.JdbcConnectorOperations;
import org.apache.datawise.backend.connector.spi.ConnectorPluginContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.jar.JarEntry;
import java.util.jar.JarOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
class ConnectorPluginLoaderTest {

    @Mock
    private JdbcConnectorOperations jdbcConnectorOperations;

    @TempDir
    Path tempConfigRoot;

    @Test
    void loadConnectors_returnsEmptyWhenPluginsDirHasNoJars() throws IOException {
        Files.createDirectories(tempConfigRoot.resolve("plugins"));
        ConnectorPluginLoader loader = new ConnectorPluginLoader(tempConfigRoot.toString(), "plugins");
        ConnectorPluginContext context = new ConnectorPluginContext(jdbcConnectorOperations);
        ConnectorPluginContributionHolder holder = new ConnectorPluginContributionHolder();

        assertTrue(loader.loadConnectors(context, holder).isEmpty());
        assertTrue(loader.loadedPluginJarNames().isEmpty());
        assertTrue(loader.failedPluginLoads().isEmpty());
    }

    @Test
    void loadConnectors_ignoresNonJarFiles() throws IOException {
        Path plugins = tempConfigRoot.resolve("plugins");
        Files.createDirectories(plugins);
        Files.writeString(plugins.resolve("readme.txt"), "not a plugin");
        ConnectorPluginLoader loader = new ConnectorPluginLoader(tempConfigRoot.toString(), "plugins");

        assertTrue(loader.loadConnectors(
                new ConnectorPluginContext(jdbcConnectorOperations),
                new ConnectorPluginContributionHolder()
        ).isEmpty());
    }

    @Test
    void loadConnectors_recordsFailureForJarWithoutProviders() throws IOException {
        Path plugins = tempConfigRoot.resolve("plugins");
        Files.createDirectories(plugins);
        Files.writeString(plugins.resolve("broken.jar"), "not-a-jar");
        ConnectorPluginLoader loader = new ConnectorPluginLoader(tempConfigRoot.toString(), "plugins");

        assertTrue(loader.loadConnectors(
                new ConnectorPluginContext(jdbcConnectorOperations),
                new ConnectorPluginContributionHolder()
        ).isEmpty());
        assertEquals(1, loader.failedPluginLoads().size());
        assertEquals("broken.jar", loader.failedPluginLoads().get(0).jarName());
        assertEquals("NO_SPI_PROVIDERS", loader.failedPluginLoads().get(0).reason());
    }

    /** BUG-006：SPI 指向缺失类时（如瘦 JAR 缺基类）ServiceLoader 抛 Error，不得阻断启动 */
    @Test
    void loadConnectors_recordsFailureWhenProviderClassIsMissing() throws IOException {
        Path plugins = tempConfigRoot.resolve("plugins");
        Files.createDirectories(plugins);
        writeJarWithSpiEntry(plugins.resolve("missing-class.jar"), "com.example.MissingProvider");
        ConnectorPluginLoader loader = new ConnectorPluginLoader(tempConfigRoot.toString(), "plugins");

        assertTrue(loader.loadConnectors(
                new ConnectorPluginContext(jdbcConnectorOperations),
                new ConnectorPluginContributionHolder()
        ).isEmpty());
        assertEquals(1, loader.failedPluginLoads().size());
        assertEquals("missing-class.jar", loader.failedPluginLoads().get(0).jarName());
    }

    private static void writeJarWithSpiEntry(Path jarPath, String providerClassName) throws IOException {
        try (JarOutputStream jar = new JarOutputStream(Files.newOutputStream(jarPath))) {
            jar.putNextEntry(new JarEntry(
                    "META-INF/services/org.apache.datawise.backend.connector.spi.DataSourceConnectorProvider"));
            jar.write((providerClassName + "\n").getBytes());
            jar.closeEntry();
        }
    }

    @Test
    void closeAll_closesLoadedPlugins() throws IOException {
        Files.createDirectories(tempConfigRoot.resolve("plugins"));
        ConnectorPluginLoader loader = new ConnectorPluginLoader(tempConfigRoot.toString(), "plugins");
        loader.loadConnectors(
                new ConnectorPluginContext(jdbcConnectorOperations),
                new ConnectorPluginContributionHolder()
        );
        loader.closeAll();
        assertTrue(loader.loadedPluginJarNames().isEmpty());
    }

    @Test
    void pluginsDirectory_resolvesUnderConfigRoot() throws IOException {
        ConnectorPluginLoader loader = new ConnectorPluginLoader(tempConfigRoot.toString(), "plugins");
        assertEquals(tempConfigRoot.resolve("plugins").toAbsolutePath().normalize(), loader.pluginsDirectory());
    }

    @Test
    void isContributedByPluginJar_rejectsParentClasspathWithoutLocalSpi() {
        Object parentScoped = new Object() {};
        ClassLoader appLoader = parentScoped.getClass().getClassLoader();
        java.net.URLClassLoader pluginLoader = new java.net.URLClassLoader(new java.net.URL[0], appLoader);
        // Empty plugin URLs + class from parent → not contributed by this jar.
        assertTrue(!ConnectorPluginLoader.isContributedByPluginJar(
                Object.class, parentScoped, pluginLoader));
    }
}
