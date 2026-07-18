package org.apache.datawise.backend.connector.plugin;

import org.apache.datawise.backend.domain.ConnectorPluginIntegrityStatus;
import org.apache.datawise.backend.domain.ConnectorPluginManifest;
import org.apache.datawise.backend.domain.ConnectorPluginManifestEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads {@code manifest.json} beside connector JARs and verifies SHA-256 digests.
 * <p>
 * Manifest parsing is intentionally dependency-light (no Jackson) so the connector-api
 * module can verify drop-in JARs without pulling JSON libraries.
 */
public final class ConnectorPluginManifestSupport {

    private static final Logger log = LoggerFactory.getLogger(ConnectorPluginManifestSupport.class);
    public static final String MANIFEST_FILE = "manifest.json";

    private static final Pattern SCHEMA_VERSION = Pattern.compile("\"schemaVersion\"\\s*:\\s*(\\d+)");
    private static final Pattern UPDATED_AT = Pattern.compile("\"updatedAt\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern CHANNEL = Pattern.compile("\"channel\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern PLUGIN_OBJECT = Pattern.compile("\\{[^{}]*\"id\"\\s*:\\s*\"[^\"]+\"[^{}]*}");

    private ConnectorPluginManifestSupport() {
    }

    public static Optional<ConnectorPluginManifest> readManifest(Path pluginsDir) {
        if (pluginsDir == null) {
            return Optional.empty();
        }
        Path path = pluginsDir.resolve(MANIFEST_FILE);
        if (!Files.isRegularFile(path)) {
            return Optional.empty();
        }
        try {
            String json = Files.readString(path, StandardCharsets.UTF_8);
            return Optional.of(parseManifest(json));
        } catch (IOException | RuntimeException ex) {
            log.warn("Failed to read connector plugin manifest {}: {}", path, ex.toString());
            return Optional.empty();
        }
    }

    static ConnectorPluginManifest parseManifest(String json) {
        int schemaVersion = intField(SCHEMA_VERSION, json, 1);
        String updatedAt = stringField(UPDATED_AT, json);
        String channel = stringField(CHANNEL, json);
        List<ConnectorPluginManifestEntry> plugins = new ArrayList<>();
        Matcher objects = PLUGIN_OBJECT.matcher(json);
        while (objects.find()) {
            String block = objects.group();
            String id = stringField(fieldPattern("id"), block);
            if (id == null || id.isBlank()) {
                continue;
            }
            plugins.add(new ConnectorPluginManifestEntry(
                    id.trim(),
                    blankToNull(stringField(fieldPattern("version"), block)),
                    blankToNull(stringField(fieldPattern("jar"), block)),
                    blankToNull(stringField(fieldPattern("sha256"), block)),
                    blankToNull(stringField(fieldPattern("downloadUrl"), block))
            ));
        }
        return new ConnectorPluginManifest(schemaVersion, blankToNull(updatedAt), blankToNull(channel), plugins);
    }

    public static Optional<ConnectorPluginManifestEntry> findById(
            ConnectorPluginManifest manifest,
            String connectorId
    ) {
        if (manifest == null || connectorId == null || connectorId.isBlank()) {
            return Optional.empty();
        }
        String normalized = connectorId.trim().toLowerCase(Locale.ROOT);
        return manifest.plugins().stream()
                .filter(entry -> entry.id() != null && entry.id().trim().toLowerCase(Locale.ROOT).equals(normalized))
                .findFirst();
    }

    public static Optional<ConnectorPluginManifestEntry> findByJar(
            ConnectorPluginManifest manifest,
            String jarName
    ) {
        if (manifest == null || jarName == null || jarName.isBlank()) {
            return Optional.empty();
        }
        String normalized = jarName.trim().toLowerCase(Locale.ROOT);
        return manifest.plugins().stream()
                .filter(entry -> entry.jar() != null && entry.jar().trim().toLowerCase(Locale.ROOT).equals(normalized))
                .findFirst();
    }

    public static String sha256Hex(Path jarPath) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
        try (InputStream in = Files.newInputStream(jarPath)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) >= 0) {
                digest.update(buffer, 0, read);
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    public static boolean matchesSha256(Path jarPath, String expectedSha256) throws IOException {
        if (expectedSha256 == null || expectedSha256.isBlank()) {
            return true;
        }
        String actual = sha256Hex(jarPath);
        return actual.equalsIgnoreCase(expectedSha256.trim());
    }

    /**
     * Resolves marketplace integrity badge for a catalog connector id.
     *
     * @param loadedJarName jar that provided this connector at runtime, or null if bundled/unavailable
     */
    public static String resolveIntegrityStatus(
            boolean available,
            boolean fromPluginJar,
            Optional<ConnectorPluginManifestEntry> manifestEntry,
            Path pluginsDir,
            String loadedJarName
    ) {
        if (available && !fromPluginJar) {
            return ConnectorPluginIntegrityStatus.BUNDLED;
        }
        if (manifestEntry.isEmpty()) {
            if (available && fromPluginJar) {
                return ConnectorPluginIntegrityStatus.UNSIGNED;
            }
            return ConnectorPluginIntegrityStatus.NONE;
        }
        ConnectorPluginManifestEntry entry = manifestEntry.get();
        String expectedSha = entry.sha256();
        if (expectedSha == null || expectedSha.isBlank()) {
            return available ? ConnectorPluginIntegrityStatus.UNSIGNED : ConnectorPluginIntegrityStatus.MISSING;
        }
        if (!available) {
            return ConnectorPluginIntegrityStatus.MISSING;
        }
        String jarName = loadedJarName != null && !loadedJarName.isBlank()
                ? loadedJarName
                : entry.jar();
        if (jarName == null || jarName.isBlank() || pluginsDir == null) {
            return ConnectorPluginIntegrityStatus.UNSIGNED;
        }
        Path jarPath = pluginsDir.resolve(jarName);
        if (!Files.isRegularFile(jarPath)) {
            return ConnectorPluginIntegrityStatus.MISSING;
        }
        try {
            return matchesSha256(jarPath, expectedSha)
                    ? ConnectorPluginIntegrityStatus.VERIFIED
                    : ConnectorPluginIntegrityStatus.MISMATCH;
        } catch (IOException ex) {
            log.warn("Failed to hash connector plugin {}: {}", jarPath, ex.toString());
            return ConnectorPluginIntegrityStatus.UNSIGNED;
        }
    }

    private static Pattern fieldPattern(String name) {
        return Pattern.compile("\"" + Pattern.quote(name) + "\"\\s*:\\s*\"([^\"]*)\"");
    }

    private static String stringField(Pattern pattern, String json) {
        Matcher matcher = pattern.matcher(json);
        return matcher.find() ? matcher.group(1) : null;
    }

    private static int intField(Pattern pattern, String json, int fallback) {
        Matcher matcher = pattern.matcher(json);
        if (!matcher.find()) {
            return fallback;
        }
        try {
            return Integer.parseInt(matcher.group(1));
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
