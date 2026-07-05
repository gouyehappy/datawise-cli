package org.apache.datawise.backend.jdbc.connection;

import org.apache.datawise.backend.jdbc.support.JdbcDriverLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Driver;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Locates JDBC driver JAR files in {@code config/drivers/}, including compatible artifact fallbacks.
 */
public final class JdbcDriverJarLocator {

    private static final Logger log = LoggerFactory.getLogger(JdbcDriverJarLocator.class);

    private final Path driversDir;

    public JdbcDriverJarLocator(Path driversDir) {
        this.driversDir = driversDir;
    }

    /** Hive JDBC dependency bundle lives in {@code drivers/hive/}. */
    public Path hiveBundleDirectory() {
        return driversDir.resolve("hive");
    }

    /** Finds exact or compatible local JAR for requested Maven coordinate. */
    public Optional<Path> findLocalJar(JdbcMavenCoordinate coordinate, String driverClass) throws IOException {
        Optional<Path> byDriverClass = findLocalJarByDriverClass(driverClass);
        if (byDriverClass.isPresent()) {
            return byDriverClass;
        }
        Path exact = driversDir.resolve(coordinate.fileName());
        if (Files.isRegularFile(exact)) {
            return Optional.of(exact);
        }
        Path hiveExact = hiveBundleDirectory().resolve(coordinate.fileName());
        if (Files.isRegularFile(hiveExact)) {
            return Optional.of(hiveExact);
        }
        Set<String> acceptable = JdbcDriverCoordinateSupport.compatibleArtifacts(coordinate.artifactId());
        if (acceptable.isEmpty()) {
            return findLocalJarByDriverClass(driverClass);
        }
        for (Path jar : listJarPaths()) {
            JdbcMavenCoordinate local = JdbcDriverCoordinateSupport.tryParseJarFileName(jar.getFileName().toString());
            if (local == null || !acceptable.contains(local.artifactId())) {
                continue;
            }
            log.info(
                    "Using compatible local JDBC driver {} instead of requested {}",
                    jar.getFileName(),
                    coordinate.fileName()
            );
            return Optional.of(jar);
        }
        return Optional.empty();
    }

    public List<String> listCachedJarNames() throws IOException {
        if (!Files.isDirectory(driversDir)) {
            return List.of();
        }
        List<String> names = new ArrayList<>();
        try (var stream = Files.list(driversDir)) {
            stream.filter(path -> Files.isRegularFile(path)
                            && path.getFileName().toString().toLowerCase().endsWith(".jar"))
                    .map(path -> path.getFileName().toString())
                    .sorted()
                    .forEach(names::add);
        }
        return List.copyOf(names);
    }

    private Optional<Path> findLocalJarByDriverClass(String driverClass) throws IOException {
        if (driverClass == null || driverClass.isBlank()) {
            return Optional.empty();
        }
        String trimmed = driverClass.trim();
        for (Path jar : listJarPaths()) {
            if (jarContainsDriverClass(jar, trimmed)) {
                log.info("Using local JDBC driver {} matching driver class {}", jar.getFileName(), trimmed);
                return Optional.of(jar);
            }
        }
        return Optional.empty();
    }

    private List<Path> listJarPaths() throws IOException {
        List<Path> jars = new ArrayList<>();
        collectJarPaths(driversDir, jars);
        Path hiveDir = hiveBundleDirectory();
        if (!hiveDir.equals(driversDir)) {
            collectJarPaths(hiveDir, jars);
        }
        return jars;
    }

    private static void collectJarPaths(Path directory, List<Path> jars) throws IOException {
        if (!Files.isDirectory(directory)) {
            return;
        }
        try (var stream = Files.list(directory)) {
            stream.filter(path -> Files.isRegularFile(path)
                            && path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".jar"))
                    .sorted()
                    .forEach(jars::add);
        }
    }

    private static boolean jarContainsDriverClass(Path jarPath, String driverClass) {
        try {
            URL jarUrl = jarPath.toUri().toURL();
            try (URLClassLoader classLoader = new URLClassLoader(
                    new URL[]{jarUrl},
                    JdbcDriverLoader.class.getClassLoader()
            )) {
                Class<?> clazz = Class.forName(driverClass, false, classLoader);
                return Driver.class.isAssignableFrom(clazz);
            }
        } catch (Exception ex) {
            return false;
        }
    }
}
