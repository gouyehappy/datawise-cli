package org.apache.datawise.backend.security;

import com.sun.net.httpserver.HttpServer;
import org.apache.datawise.backend.configstore.ConfigDirectoryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SecretReferenceResolverTest {

    @TempDir
    Path temp;

    @Test
    void resolvesFileRelativeToConfigDir() throws Exception {
        Path secrets = temp.resolve("secrets");
        Files.createDirectories(secrets);
        Files.writeString(secrets.resolve("db.txt"), "s3cret\n", StandardCharsets.UTF_8);
        ConfigDirectoryService configDirectory = new ConfigDirectoryService(temp);
        SecretReferenceResolver resolver = new SecretReferenceResolver(configDirectory);

        assertTrue(resolver.isReference("dwsecret:file:secrets/db.txt"));
        assertEquals("s3cret", resolver.resolve("dwsecret:file:secrets/db.txt"));
    }

    @Test
    void rejectsMissingEnv() {
        ConfigDirectoryService configDirectory = new ConfigDirectoryService(temp);
        SecretReferenceResolver resolver = new SecretReferenceResolver(configDirectory);
        assertThrows(IllegalStateException.class, () ->
                resolver.resolve("dwsecret:env:DATAWISE_TEST_MISSING_SECRET_VAR_XYZ"));
    }

    @Test
    void rejectsUnknownScheme() {
        ConfigDirectoryService configDirectory = new ConfigDirectoryService(temp);
        SecretReferenceResolver resolver = new SecretReferenceResolver(configDirectory);
        assertThrows(IllegalArgumentException.class, () ->
                resolver.resolve("dwsecret:kms:alias/datawise"));
    }

    @Test
    void resolvesVaultKvV2Field() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/secret/data/datawise/db", exchange -> {
            byte[] body = """
                    {"data":{"data":{"password":"from-vault","user":"app"}}}
                    """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        try {
            String addr = "http://127.0.0.1:" + server.getAddress().getPort();
            SecretReferenceResolver resolver = new SecretReferenceResolver(
                    new ConfigDirectoryService(temp),
                    HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build(),
                    Map.of(
                            "DATAWISE_VAULT_ADDR", addr,
                            "DATAWISE_VAULT_TOKEN", "test-token"
                    )::get
            );
            assertEquals(
                    "from-vault",
                    resolver.resolve("dwsecret:vault:secret/data/datawise/db#password")
            );
        } finally {
            server.stop(0);
        }
    }

    @Test
    void extractVaultFieldSupportsKvV1Shape() {
        String json = "{\"data\":{\"password\":\"v1-secret\"}}";
        assertEquals(
                "v1-secret",
                SecretReferenceResolver.extractVaultField(json, "password", "dwsecret:vault:x#password")
        );
    }
}
