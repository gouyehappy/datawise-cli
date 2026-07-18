package org.apache.datawise.backend.connector.plugin;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;

/**
 * Downloads a connector plugin JAR from a manifest {@code downloadUrl} into {@code config/plugins}.
 */
public final class ConnectorPluginRemoteInstallSupport {

    public static final long MAX_JAR_BYTES = 120L * 1024L * 1024L;
    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https");

    private ConnectorPluginRemoteInstallSupport() {
    }

    public static Path install(
            String downloadUrl,
            Path pluginsDir,
            String jarName,
            String expectedSha256
    ) throws IOException {
        return install(
                downloadUrl,
                pluginsDir,
                jarName,
                expectedSha256,
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).followRedirects(HttpClient.Redirect.NORMAL).build()
        );
    }

    static Path install(
            String downloadUrl,
            Path pluginsDir,
            String jarName,
            String expectedSha256,
            HttpClient httpClient
    ) throws IOException {
        if (downloadUrl == null || downloadUrl.isBlank()) {
            throw new IllegalArgumentException("downloadUrl is required");
        }
        if (pluginsDir == null) {
            throw new IllegalArgumentException("pluginsDir is required");
        }
        String safeJar = sanitizeJarName(jarName);
        URI uri = URI.create(downloadUrl.trim());
        String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase(Locale.ROOT) : "";
        if (!ALLOWED_SCHEMES.contains(scheme)) {
            throw new IllegalArgumentException("downloadUrl must be http(s): " + downloadUrl);
        }
        Files.createDirectories(pluginsDir);
        Path target = pluginsDir.resolve(safeJar).normalize();
        if (!target.startsWith(pluginsDir.normalize())) {
            throw new IllegalArgumentException("Invalid jar path: " + safeJar);
        }
        Path temp = pluginsDir.resolve(safeJar + ".download.tmp");
        try {
            downloadTo(httpClient, uri, temp);
            if (expectedSha256 != null && !expectedSha256.isBlank()) {
                if (!ConnectorPluginManifestSupport.matchesSha256(temp, expectedSha256)) {
                    throw new IllegalStateException(
                            "Downloaded JAR SHA-256 does not match manifest for " + safeJar
                    );
                }
            }
            try {
                Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException ex) {
                Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING);
            }
            return target;
        } catch (IOException | RuntimeException ex) {
            try {
                Files.deleteIfExists(temp);
            } catch (IOException ignored) {
                // best-effort cleanup
            }
            throw ex;
        }
    }

    static String sanitizeJarName(String jarName) {
        if (jarName == null || jarName.isBlank()) {
            throw new IllegalArgumentException("jar name is required in manifest");
        }
        String name = jarName.trim();
        if (name.contains("/") || name.contains("\\") || name.contains("..")) {
            throw new IllegalArgumentException("jar name must be a plain file name: " + jarName);
        }
        if (!name.toLowerCase(Locale.ROOT).endsWith(".jar")) {
            throw new IllegalArgumentException("jar name must end with .jar: " + jarName);
        }
        return name;
    }

    private static void downloadTo(HttpClient httpClient, URI uri, Path target) throws IOException {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofMinutes(3))
                .header("User-Agent", "DataWise-ConnectorInstall/1.0")
                .GET()
                .build();
        try {
            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
            int status = response.statusCode();
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("Download failed HTTP " + status + " for " + uri);
            }
            long written = 0L;
            try (InputStream in = response.body(); OutputStream out = Files.newOutputStream(target)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = in.read(buffer)) >= 0) {
                    written += read;
                    if (written > MAX_JAR_BYTES) {
                        throw new IllegalStateException(
                                "Download exceeds max size (" + MAX_JAR_BYTES + " bytes): " + uri
                        );
                    }
                    out.write(buffer, 0, read);
                }
            }
            if (written == 0L) {
                throw new IllegalStateException("Downloaded empty JAR: " + uri);
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("Download interrupted: " + uri, ex);
        }
    }
}
