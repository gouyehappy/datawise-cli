package org.apache.datawise.backend.jdbc.support;

import org.apache.datawise.backend.common.support.ConfigDirectoryLocator;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.apache.datawise.backend.jdbc.connection.JdbcDriverCoordinateSupport;
import org.apache.datawise.backend.jdbc.connection.JdbcDriverJarLocator;
import org.apache.datawise.backend.jdbc.connection.JdbcMavenCoordinate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Driver;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Downloads JDBC driver JARs to {@code config/drivers/} and keeps loaded drivers in memory.
 */
@Component
public class JdbcDriverLoader {

    private static final Logger log = LoggerFactory.getLogger(JdbcDriverLoader.class);
    private static final String MAVEN_CENTRAL = "https://repo1.maven.org/maven2";

    private final Path driversDir;
    private final JdbcDriverJarLocator jarLocator;
    private final ConcurrentMap<String, LoadedDriver> cache = new ConcurrentHashMap<>();

    public JdbcDriverLoader(@Value("${datawise.config.dir:config}") String configDir) throws IOException {
        Path configRoot = ConfigDirectoryLocator.resolve(configDir);
        this.driversDir = configRoot.resolve("drivers").toAbsolutePath().normalize();
        Files.createDirectories(driversDir);
        this.jarLocator = new JdbcDriverJarLocator(driversDir);
        log.info("JDBC drivers directory: {}", driversDir);
    }

    /**
     * Ensures driver class is loadable from local cache or Maven Central download.
     */
    public LoadedDriver ensureDriver(String mavenCoordinates, String driverClass) throws IOException, SQLException {
        JdbcMavenCoordinate coordinate = JdbcMavenCoordinate.parseFlexible(mavenCoordinates);
        String cacheKey = coordinate.cacheKey() + "|" + driverClass;
        LoadedDriver existing = cache.get(cacheKey);
        if (existing != null) {
            return existing;
        }
        if (HiveJdbcDriverBundle.isHiveDriver(driverClass) || HiveJdbcDriverBundle.isHiveMavenArtifact(coordinate)) {
            ensureHiveDriverBundle(coordinate.version());
            ThriftTransportLogLevels.applyQuietly();
        }
        Path jarPath = jarLocator.findLocalJar(coordinate, driverClass)
                .orElseGet(() -> resolveMissingJarPath(coordinate));
        boolean downloaded = false;
        if (!Files.isRegularFile(jarPath)) {
            if (HiveJdbcDriverBundle.isHiveMavenArtifact(coordinate)) {
                throw new IOException(HiveJdbcDriverBundle.installHint());
            }
            downloadJar(coordinate, jarPath);
            downloaded = true;
        }
        LoadedDriver loaded = loadDriver(jarPath, driverClass, downloaded, !downloaded);
        cache.put(cacheKey, loaded);
        return loaded;
    }

    /**
     * Loads driver from local JAR only; does not download from Maven Central.
     *
     * @return empty when jar is missing or already cached
     */
    public Optional<LoadedDriver> preloadIfPresent(String mavenCoordinates, String driverClass) {
        if (mavenCoordinates == null || mavenCoordinates.isBlank()
                || driverClass == null || driverClass.isBlank()) {
            return Optional.empty();
        }
        try {
            JdbcMavenCoordinate coordinate = JdbcMavenCoordinate.parseFlexible(mavenCoordinates.trim());
            String cacheKey = coordinate.cacheKey() + "|" + driverClass.trim();
            if (cache.containsKey(cacheKey)) {
                return Optional.empty();
            }
            Path jarPath = jarLocator.findLocalJar(coordinate, driverClass.trim()).orElse(null);
            if (jarPath == null || !Files.isRegularFile(jarPath)) {
                return Optional.empty();
            }
            LoadedDriver loaded = loadDriver(jarPath, driverClass.trim(), false, true);
            cache.put(cacheKey, loaded);
            return Optional.of(loaded);
        } catch (Throwable ex) {
            ExceptionLogging.warn(
                    log,
                    "Failed to preload JDBC driver " + mavenCoordinates + " " + driverClass,
                    ex
            );
            return Optional.empty();
        }
    }

    /** Returns true when a matching or compatible JAR exists locally. */
    public boolean hasCachedJar(String mavenCoordinates) {
        try {
            JdbcMavenCoordinate coordinate = JdbcMavenCoordinate.parseFlexible(mavenCoordinates);
            return jarLocator.findLocalJar(coordinate, null).isPresent();
        } catch (Exception ex) {
            return false;
        }
    }

    /** Returns local JAR filename when present; empty when download would be required. */
    public Optional<String> resolveLocalJarFileName(String mavenCoordinates, String driverClass) {
        try {
            JdbcMavenCoordinate coordinate = JdbcMavenCoordinate.parseFlexible(mavenCoordinates);
            return jarLocator.findLocalJar(coordinate, driverClass)
                    .map(path -> path.getFileName().toString());
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    public Path driversDirectory() {
        return driversDir;
    }

    public List<String> listCachedJarNames() throws IOException {
        return jarLocator.listCachedJarNames();
    }

    /**
     * Lists JARs under {@code config/drivers/} (including one-level subdirs such as {@code hive/}).
     *
     * @return relative path from drivers dir (e.g. {@code mysql-….jar} or {@code hive/hive-….jar})
     */
    public List<CachedDriverJar> listCachedDriverJars() throws IOException {
        if (!Files.isDirectory(driversDir)) {
            return List.of();
        }
        List<CachedDriverJar> jars = new ArrayList<>();
        try (var stream = Files.walk(driversDir, 2)) {
            stream.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".jar"))
                    .sorted()
                    .forEach(path -> {
                        Path relative = driversDir.relativize(path);
                        String relativePath = relative.toString().replace('\\', '/');
                        boolean loaded = cache.values().stream()
                                .anyMatch(entry -> entry.jarPath().equals(path));
                        long size;
                        try {
                            size = Files.size(path);
                        } catch (IOException ex) {
                            size = 0L;
                        }
                        jars.add(new CachedDriverJar(
                                path.getFileName().toString(),
                                relativePath,
                                size,
                                loaded
                        ));
                    });
        }
        return List.copyOf(jars);
    }

    /**
     * Deletes a cached driver JAR. {@code relativePath} must be a plain file name or a single
     * subdirectory path under {@code config/drivers/} (e.g. {@code hive/x.jar}).
     */
    public boolean deleteCachedJar(String relativePath) throws IOException {
        if (relativePath == null || relativePath.isBlank()) {
            throw new IllegalArgumentException("relativePath is required");
        }
        String normalized = relativePath.trim().replace('\\', '/');
        if (normalized.contains("..") || normalized.startsWith("/") || normalized.startsWith("\\")) {
            throw new IllegalArgumentException("Invalid driver path: " + relativePath);
        }
        Path target = driversDir.resolve(normalized).normalize();
        if (!target.startsWith(driversDir.normalize())) {
            throw new IllegalArgumentException("Invalid driver path: " + relativePath);
        }
        if (!Files.isRegularFile(target)) {
            return false;
        }
        cache.entrySet().removeIf(entry -> entry.getValue().jarPath().equals(target));
        return Files.deleteIfExists(target);
    }

    /**
     * Deletes an entire driver bundle subdirectory under {@code config/drivers/} (e.g. {@code hive}).
     *
     * @return number of JAR files deleted
     */
    public int deleteCachedBundle(String bundleDirName) throws IOException {
        if (bundleDirName == null || bundleDirName.isBlank()) {
            throw new IllegalArgumentException("bundleDir is required");
        }
        String normalized = bundleDirName.trim().replace('\\', '/');
        if (normalized.contains("/") || normalized.contains("..") || normalized.contains("\\")) {
            throw new IllegalArgumentException("bundleDir must be a single directory name: " + bundleDirName);
        }
        Path bundleDir = driversDir.resolve(normalized).normalize();
        if (!bundleDir.startsWith(driversDir.normalize()) || !Files.isDirectory(bundleDir)) {
            return 0;
        }
        int deleted = 0;
        try (var stream = Files.list(bundleDir)) {
            for (Path path : stream.filter(Files::isRegularFile).toList()) {
                if (!path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".jar")) {
                    continue;
                }
                cache.entrySet().removeIf(entry -> entry.getValue().jarPath().equals(path));
                if (Files.deleteIfExists(path)) {
                    deleted++;
                }
            }
        }
        try (var remaining = Files.list(bundleDir)) {
            if (remaining.findAny().isEmpty()) {
                Files.deleteIfExists(bundleDir);
            }
        }
        return deleted;
    }

    public record CachedDriverJar(
            String fileName,
            String relativePath,
            long sizeBytes,
            boolean loadedInMemory
    ) {
    }

    public static boolean isMavenCoordinates(String value) {
        return JdbcDriverCoordinateSupport.isMavenCoordinates(value);
    }

    public static String normalizeDriverInput(String input) {
        return JdbcDriverCoordinateSupport.normalizeDriverInput(input);
    }

    private Path resolveMissingJarPath(JdbcMavenCoordinate coordinate) {
        if (HiveJdbcDriverBundle.isHiveDriverArtifact(coordinate)) {
            return jarLocator.hiveBundleDirectory().resolve(coordinate.fileName());
        }
        return driversDir.resolve(coordinate.fileName());
    }

    private void ensureHiveDriverBundle(String version) throws IOException {
        Path hiveDir = jarLocator.hiveBundleDirectory();
        Files.createDirectories(hiveDir);
        for (String coordinates : HiveJdbcDriverBundle.coordinatesForVersion(version)) {
            JdbcMavenCoordinate artifact = JdbcMavenCoordinate.parse(coordinates);
            Path target = hiveDir.resolve(artifact.fileName());
            if (!Files.isRegularFile(target)) {
                downloadJar(artifact, target);
            }
        }
    }

    private void downloadJar(JdbcMavenCoordinate coordinate, Path target) throws IOException {
        URI uri = URI.create(MAVEN_CENTRAL + "/" + coordinate.repositoryPath());
        Files.createDirectories(target.getParent());
        log.info("Downloading JDBC driver from Maven Central: {}", coordinate.cacheKey());
        try (InputStream input = uri.toURL().openStream()) {
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private LoadedDriver loadDriver(Path jarPath, String driverClass, boolean downloaded, boolean cached)
            throws IOException, SQLException {
        URL[] jarUrls = buildDriverClasspath(jarPath, driverClass);
        ClassLoader parent = HiveJdbcDriverBundle.isHiveDriver(driverClass)
                ? ClassLoader.getPlatformClassLoader()
                : JdbcDriverLoader.class.getClassLoader();
        URLClassLoader classLoader = new URLClassLoader(jarUrls, parent);
        try {
            Class<?> clazz = Class.forName(driverClass, true, classLoader);
            Object instance = clazz.getDeclaredConstructor().newInstance();
            if (!(instance instanceof Driver driver)) {
                throw new SQLException("Class is not a JDBC Driver: " + driverClass);
            }
            if (downloaded) {
                log.info("Loaded JDBC driver {} from downloaded jar {}", driverClass, jarPath.getFileName());
            } else if (cached) {
                log.debug("Preloaded JDBC driver {} from {}", driverClass, jarPath.getFileName());
            }
            return new LoadedDriver(driver, jarPath, downloaded, cached, classLoader);
        } catch (ReflectiveOperationException ex) {
            if (HiveJdbcDriverBundle.isHiveDriver(driverClass)) {
                throw new SQLException(HiveJdbcDriverBundle.installHint(), ex);
            }
            throw new SQLException("Failed to load JDBC driver class: " + driverClass, ex);
        }
    }

    private URL[] buildDriverClasspath(Path primaryJar, String driverClass) throws IOException {
        Set<URL> urls = new LinkedHashSet<>();
        if (HiveJdbcDriverBundle.isHiveDriver(driverClass)) {
            appendJarDirectory(urls, jarLocator.hiveBundleDirectory());
            appendJarDirectory(urls, driversDir);
        }
        urls.add(primaryJar.toUri().toURL());
        return urls.toArray(URL[]::new);
    }

    private void appendJarDirectory(Set<URL> urls, Path directory) throws IOException {
        if (directory == null || !Files.isDirectory(directory)) {
            return;
        }
        List<Path> jars = new ArrayList<>();
        try (var stream = Files.list(directory)) {
            stream.filter(path -> Files.isRegularFile(path)
                            && path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".jar"))
                    .sorted()
                    .forEach(jars::add);
        }
        for (Path jar : jars) {
            urls.add(jar.toUri().toURL());
        }
    }

    public record LoadedDriver(
            Driver driver,
            Path jarPath,
            boolean downloaded,
            boolean cached,
            ClassLoader classLoader
    ) {
    }

    /**
     * @deprecated use {@link JdbcMavenCoordinate}
     */
    @Deprecated
    public record MavenCoordinate(String groupId, String artifactId, String version) {
        public static MavenCoordinate parse(String coordinates) {
            JdbcMavenCoordinate coordinate = JdbcMavenCoordinate.parse(coordinates);
            return new MavenCoordinate(coordinate.groupId(), coordinate.artifactId(), coordinate.version());
        }

        public static MavenCoordinate parseFlexible(String input) {
            JdbcMavenCoordinate coordinate = JdbcMavenCoordinate.parseFlexible(input);
            return new MavenCoordinate(coordinate.groupId(), coordinate.artifactId(), coordinate.version());
        }

        public String fileName() {
            return artifactId + "-" + version + ".jar";
        }

        public String cacheKey() {
            return groupId + ":" + artifactId + ":" + version;
        }

        public String repositoryPath() {
            String groupPath = groupId.replace('.', '/');
            return groupPath + "/" + artifactId + "/" + version + "/" + fileName();
        }
    }
}
