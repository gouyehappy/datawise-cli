package org.apache.datawise.backend.jdbc.connection;

import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.jdbc.support.JdbcDriverDefaultsProvider;
import org.apache.datawise.backend.jdbc.support.JdbcDriverLoader;

import java.sql.SQLException;
import java.util.Properties;

/**
 * Resolves JDBC driver coordinates and connection properties for pool/direct open paths.
 */
public final class JdbcPoolDriverResolver {

    private JdbcPoolDriverResolver() {
    }

    public record ResolvedDriver(String mavenCoordinates, String driverClass) {
    }

    /** Builds JDBC {@link Properties} from connection auth settings. */
    public static Properties buildConnectionProperties(ConnectionEntity entity) {
        Properties properties = new Properties();
        if (entity.getAuthType() != null && "NONE".equalsIgnoreCase(entity.getAuthType())) {
            return properties;
        }
        if (entity.getUsername() != null) {
            properties.setProperty("user", entity.getUsername());
        }
        if (entity.getPassword() != null) {
            properties.setProperty("password", entity.getPassword());
        }
        return properties;
    }

    /**
     * Resolves Maven coordinates and driver class from entity fields or dbType defaults.
     *
     * @return null when no driver is configured and no default exists for dbType
     */
    public static ResolvedDriver resolve(
            ConnectionEntity entity,
            JdbcDriverDefaultsProvider defaultsProvider
    ) throws SQLException {
        String mavenCoordinates = resolveDriverMaven(entity.getDriver());
        String driverClass = entity.getDriverClass();
        if (mavenCoordinates == null) {
            JdbcDriverDefaultsProvider.DriverDefaults defaults = defaultsProvider
                    .defaultsFor(entity.getDbType())
                    .orElse(null);
            if (defaults == null) {
                return null;
            }
            mavenCoordinates = defaults.mavenCoordinates();
            if (driverClass == null || driverClass.isBlank()) {
                driverClass = defaults.driverClass();
            }
        }
        if (mavenCoordinates == null || mavenCoordinates.isBlank()) {
            return null;
        }
        if (driverClass == null || driverClass.isBlank()) {
            throw new SQLException("driverClass is required when driver Maven coordinates are configured");
        }
        return new ResolvedDriver(mavenCoordinates.trim(), driverClass.trim());
    }

    private static String resolveDriverMaven(String driver) {
        if (driver == null || driver.isBlank()) {
            return null;
        }
        try {
            return JdbcDriverLoader.normalizeDriverInput(driver);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
