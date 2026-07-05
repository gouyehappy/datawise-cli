package org.apache.datawise.backend.database.explorer;

import org.apache.datawise.backend.config.ExplorerSchemaProperties;
import org.apache.datawise.backend.connector.catalog.SchemaSession;
import org.apache.datawise.backend.connector.facade.ConnectorFacade;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.common.support.DatawiseMetricsCatalog;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.sql.SQLException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Reuses one {@link SchemaSession} per connection id for rapid explorer tree expands.
 * JDBC {@link java.sql.Connection} is not thread-safe; access is serialized per connection id.
 */
@Component
public class ExplorerSchemaSessionPool {

    private static final Logger log = LoggerFactory.getLogger(ExplorerSchemaSessionPool.class);

    private final ConnectorFacade connectorFacade;
    private final ExplorerSchemaProperties properties;
    private final ConcurrentMap<String, PooledSession> sessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, ReentrantLock> locks = new ConcurrentHashMap<>();

    public ExplorerSchemaSessionPool(
            ConnectorFacade connectorFacade,
            ExplorerSchemaProperties properties,
            ObjectProvider<MeterRegistry> meterRegistryProvider
    ) {
        this.connectorFacade = connectorFacade;
        this.properties = properties != null ? properties : new ExplorerSchemaProperties();
        MeterRegistry meterRegistry = meterRegistryProvider.getIfAvailable();
        if (meterRegistry != null) {
            Gauge.builder(DatawiseMetricsCatalog.EXPLORER_SCHEMA_SESSIONS_ACTIVE, sessions, ConcurrentMap::size)
                    .description("Cached explorer schema introspection sessions keyed by connection id")
                    .register(meterRegistry);
        }
    }

    public <T> T withSession(ConnectionEntity connection, SessionCallback<T> callback) throws Exception {
        String connectionId = connection.getId();
        ReentrantLock lock = locks.computeIfAbsent(connectionId, ignored -> new ReentrantLock());
        lock.lock();
        try {
            evictExpiredSession(connectionId);
            evictExpiredSessionsIfNeeded();
            PooledSession pooled = openOrReuse(connection);
            try {
                return callback.apply(pooled.session());
            } finally {
                pooled.touch();
            }
        } finally {
            lock.unlock();
        }
    }

    public void invalidate(String connectionId) {
        if (connectionId == null || connectionId.isBlank()) {
            return;
        }
        PooledSession removed = sessions.remove(connectionId);
        if (removed != null) {
            removed.closeQuietly();
        }
    }

    private PooledSession openOrReuse(ConnectionEntity connection) throws SQLException {
        String connectionId = connection.getId();
        PooledSession existing = sessions.get(connectionId);
        if (existing != null && !existing.isExpired()) {
            return existing;
        }
        if (existing != null) {
            sessions.remove(connectionId, existing);
            existing.closeQuietly();
        }
        enforceMaxEntries();
        SchemaSession session = connectorFacade.catalog().openSchemaSession(connection);
        PooledSession pooled = new PooledSession(session, properties.getIdleTimeoutMs());
        sessions.put(connectionId, pooled);
        return pooled;
    }

    private void evictExpiredSession(String connectionId) {
        if (connectionId == null || connectionId.isBlank()) {
            return;
        }
        PooledSession pooled = sessions.get(connectionId);
        if (pooled != null && pooled.isExpired() && sessions.remove(connectionId, pooled)) {
            pooled.closeQuietly();
        }
    }

    private void evictExpiredSessionsIfNeeded() {
        if (sessions.size() <= properties.getMaxEntries()) {
            return;
        }
        evictExpiredSessions();
    }

    private void evictExpiredSessions() {
        for (var entry : sessions.entrySet()) {
            PooledSession pooled = entry.getValue();
            if (pooled.isExpired()) {
                if (sessions.remove(entry.getKey(), pooled)) {
                    pooled.closeQuietly();
                }
            }
        }
    }

    private void enforceMaxEntries() {
        if (sessions.size() < properties.getMaxEntries()) {
            return;
        }
        sessions.entrySet().stream()
                .min((left, right) -> Long.compare(left.getValue().lastAccessMs(), right.getValue().lastAccessMs()))
                .ifPresent(oldest -> {
                    PooledSession removed = sessions.remove(oldest.getKey());
                    if (removed != null) {
                        removed.closeQuietly();
                    }
                });
    }

    @FunctionalInterface
    public interface SessionCallback<T> {
        T apply(SchemaSession session) throws Exception;
    }

    private static final class PooledSession {
        private final SchemaSession session;
        private final long idleTimeoutMs;
        private volatile long lastAccessMs;

        private PooledSession(SchemaSession session, long idleTimeoutMs) {
            this.session = session;
            this.idleTimeoutMs = idleTimeoutMs;
            touch();
        }

        private SchemaSession session() {
            return session;
        }

        private void touch() {
            lastAccessMs = System.currentTimeMillis();
        }

        private long lastAccessMs() {
            return lastAccessMs;
        }

        private boolean isExpired() {
            return System.currentTimeMillis() - lastAccessMs > idleTimeoutMs;
        }

        private void closeQuietly() {
            try {
                session.close();
            } catch (SQLException ex) {
                ExceptionLogging.warn(log, "Failed to close explorer schema session", ex);
            }
        }
    }
}
