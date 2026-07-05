package org.apache.datawise.backend.jdbc.connection;

import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.schema.CatalogSchemaScope;
import org.apache.datawise.backend.jdbc.support.JdbcConnectionCallback;
import org.apache.datawise.backend.jdbc.error.JdbcConnectionErrors;
import org.apache.datawise.backend.jdbc.support.JdbcDriverConnectionFactory;
import org.apache.datawise.backend.jdbc.support.DbTypeFamilies;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/**
 * JDBC connection lifecycle: borrow from pool, switch catalog/schema, transient retry and close.
 */
@Component
public class JdbcConnectionAccessor {

    private final JdbcDriverConnectionFactory connectionFactory;

    public JdbcConnectionAccessor(JdbcDriverConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    /** Opens a pooled JDBC connection without switching catalog/schema. */
    public Connection openConnection(ConnectionEntity entity) throws SQLException {
        return connectionFactory.open(entity);
    }

    /** Drops cached pool for one connection id (after config change or hard failure). */
    public void evictPool(String connectionId) {
        connectionFactory.evictPool(connectionId);
    }

    /**
     * Opens a connection and switches to the requested database/catalog.
     * Retries once after pool eviction on transient failures.
     */
    public Connection openPreparedConnection(ConnectionEntity entity, String database) throws SQLException {
        return withTransientRetry(entity, () -> {
            Connection connection = openConnection(entity);
            applyCatalog(connection, entity.getDbType(), database);
            return connection;
        });
    }

    /**
     * Runs a callback on a short-lived connection with catalog switch and automatic close.
     */
    public <T> T withConnection(
            ConnectionEntity entity,
            String database,
            JdbcConnectionCallback<T> callback
    ) throws SQLException {
        return withTransientRetry(entity, () -> runWithConnection(entity, database, callback));
    }

    /** Quick health check used by connection test flow. */
    public boolean canConnect(ConnectionEntity entity) throws SQLException {
        return withConnection(entity, null, connection -> connection.isValid(3));
    }

    /** Switches PostgreSQL schema or JDBC catalog for other families. */
    public void applyCatalog(Connection connection, String dbType, String database) throws SQLException {
        if (database == null || database.isBlank()) {
            return;
        }
        if (connection.isClosed()) {
            throw new java.sql.SQLTransientConnectionException("Connection is closed");
        }
        String normalized = DbTypeFamilies.normalize(dbType);
        if (catalogAlreadyApplied(connection, normalized, database)) {
            return;
        }
        if (DbTypeFamilies.isPostgresqlFamily(normalized)) {
            connection.setSchema(database.trim());
        } else if (DbTypeFamilies.isCatalogSchemaFamily(normalized)) {
            CatalogSchemaScope scope = CatalogSchemaScope.parse(database);
            if (scope.catalog() != null && !scope.catalog().isBlank()) {
                connection.setCatalog(scope.catalog());
            }
            if (scope.hasSchema()) {
                connection.setSchema(scope.schema());
            }
        } else {
            connection.setCatalog(database);
        }
    }

    static boolean catalogAlreadyApplied(Connection connection, String normalizedDbType, String database)
            throws SQLException {
        String trimmed = database.trim();
        if (DbTypeFamilies.isPostgresqlFamily(normalizedDbType)) {
            return Objects.equals(trimmed, connection.getSchema());
        }
        if (DbTypeFamilies.isCatalogSchemaFamily(normalizedDbType)) {
            CatalogSchemaScope scope = CatalogSchemaScope.parse(database);
            if (scope.catalog() != null && !scope.catalog().isBlank()
                    && !Objects.equals(scope.catalog(), connection.getCatalog())) {
                return false;
            }
            if (scope.hasSchema() && !Objects.equals(scope.schema(), connection.getSchema())) {
                return false;
            }
            return true;
        }
        return Objects.equals(trimmed, connection.getCatalog());
    }

    private <T> T runWithConnection(
            ConnectionEntity entity,
            String database,
            JdbcConnectionCallback<T> callback
    ) throws SQLException {
        try (Connection connection = openConnection(entity)) {
            applyCatalog(connection, entity.getDbType(), database);
            return callback.apply(connection);
        }
    }

    private <T> T withTransientRetry(
            ConnectionEntity entity,
            SqlSupplier<T> action
    ) throws SQLException {
        try {
            return action.get();
        } catch (SQLException ex) {
            if (!JdbcConnectionErrors.isTransientConnectionFailure(ex)) {
                throw new SQLException(JdbcConnectionErrors.toUserMessage(entity, ex), ex);
            }
            connectionFactory.evictPool(entity.getId());
            try {
                return action.get();
            } catch (SQLException retryEx) {
                throw new SQLException(JdbcConnectionErrors.toUserMessage(entity, retryEx), retryEx);
            }
        }
    }

    @FunctionalInterface
    private interface SqlSupplier<T> {
        T get() throws SQLException;
    }
}
