package org.apache.datawise.backend.database.connection;

import org.apache.datawise.backend.domain.JdbcDriverResolveRequest;
import org.apache.datawise.backend.domain.JdbcDriverResolveResult;
import org.apache.datawise.backend.jdbc.support.JdbcDriverLoader;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.sql.SQLException;

@Service
public class JdbcDriverService {

    private final JdbcDriverLoader jdbcDriverLoader;

    public JdbcDriverService(JdbcDriverLoader jdbcDriverLoader) {
        this.jdbcDriverLoader = jdbcDriverLoader;
    }

    public JdbcDriverResolveResult resolve(JdbcDriverResolveRequest request) throws SQLException {
        if (request == null || request.mavenCoordinates() == null || request.mavenCoordinates().isBlank()) {
            throw new IllegalArgumentException("mavenCoordinates is required");
        }
        if (request.driverClass() == null || request.driverClass().isBlank()) {
            throw new IllegalArgumentException("driverClass is required");
        }
        String coordinates = JdbcDriverLoader.normalizeDriverInput(request.mavenCoordinates());
        String driverClass = request.driverClass().trim();
        try {
            var preloaded = jdbcDriverLoader.preloadIfPresent(coordinates, driverClass);
            if (preloaded.isPresent()) {
                var loaded = preloaded.get();
                return buildResult(coordinates, driverClass, loaded, false, true);
            }
            JdbcDriverLoader.LoadedDriver loaded = jdbcDriverLoader.ensureDriver(coordinates, driverClass);
            return buildResult(coordinates, driverClass, loaded, loaded.downloaded(), !loaded.downloaded());
        } catch (IOException ex) {
            if (jdbcDriverLoader.hasCachedJar(coordinates)) {
                throw new SQLException(
                        "Failed to load JDBC driver from local jar under config/drivers/: " + ex.getMessage(),
                        ex
                );
            }
            throw new SQLException("Failed to download driver from Maven Central: " + ex.getMessage(), ex);
        }
    }

    private JdbcDriverResolveResult buildResult(
            String requestedCoordinates,
            String driverClass,
            JdbcDriverLoader.LoadedDriver loaded,
            boolean downloaded,
            boolean cached
    ) {
        // Keep the coordinates the user/API asked for. Deriving them from the jar filename
        // previously rewrote e.g. elasticsearch 7.3.0 → 8.17.5 when a wrong local jar matched.
        return new JdbcDriverResolveResult(
                requestedCoordinates,
                driverClass,
                loaded.jarPath().toString(),
                downloaded,
                cached
        );
    }
}
