package org.apache.datawise.backend.connector.plugin;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ConnectorPluginRemoteInstallSupportTest {

    @TempDir
    Path temp;

    @Test
    void downloadsAndVerifiesSha256() throws Exception {
        byte[] jarBytes = "fake-jar-bytes".getBytes(StandardCharsets.UTF_8);
        String digest = ConnectorPluginManifestSupport.sha256Hex(
                Files.write(temp.resolve("source.jar"), jarBytes)
        );

        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/oracle.jar", exchange -> {
            exchange.sendResponseHeaders(200, jarBytes.length);
            exchange.getResponseBody().write(jarBytes);
            exchange.close();
        });
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        try {
            Path plugins = temp.resolve("plugins");
            Path installed = ConnectorPluginRemoteInstallSupport.install(
                    "http://127.0.0.1:" + server.getAddress().getPort() + "/oracle.jar",
                    plugins,
                    "datawise-connector-oracle.jar",
                    digest,
                    HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build()
            );
            assertTrue(Files.isRegularFile(installed));
            assertEquals(digest, ConnectorPluginManifestSupport.sha256Hex(installed));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void rejectsShaMismatch() throws Exception {
        byte[] jarBytes = "other".getBytes(StandardCharsets.UTF_8);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/bad.jar", exchange -> {
            exchange.sendResponseHeaders(200, jarBytes.length);
            exchange.getResponseBody().write(jarBytes);
            exchange.close();
        });
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        try {
            assertThrows(IllegalStateException.class, () ->
                    ConnectorPluginRemoteInstallSupport.install(
                            "http://127.0.0.1:" + server.getAddress().getPort() + "/bad.jar",
                            temp.resolve("plugins"),
                            "datawise-connector-oracle.jar",
                            "deadbeef",
                            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build()
                    )
            );
        } finally {
            server.stop(0);
        }
    }

    @Test
    void sanitizesJarName() {
        assertThrows(IllegalArgumentException.class, () ->
                ConnectorPluginRemoteInstallSupport.sanitizeJarName("../evil.jar"));
        assertThrows(IllegalArgumentException.class, () ->
                ConnectorPluginRemoteInstallSupport.sanitizeJarName("not-a-jar"));
    }
}
