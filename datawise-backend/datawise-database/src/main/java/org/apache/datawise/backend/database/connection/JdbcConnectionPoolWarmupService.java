package org.apache.datawise.backend.database.connection;

import org.apache.datawise.backend.config.JdbcPoolProperties;
import org.apache.datawise.backend.jdbc.support.JdbcDriverConnectionFactory;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * After a successful connect probe, borrows connections up to {@link JdbcPoolProperties#getMinimumIdle()}
 * so the first SQL / explorer load avoids cold-pool latency.
 */
@Service
public class JdbcConnectionPoolWarmupService {

    private static final Logger log = LoggerFactory.getLogger(JdbcConnectionPoolWarmupService.class);
    private static final int MAX_WARMUP_PARALLELISM = 3;

    private final JdbcDriverConnectionFactory connectionFactory;
    private final JdbcPoolProperties poolProperties;

    public JdbcConnectionPoolWarmupService(
            JdbcDriverConnectionFactory connectionFactory,
            JdbcPoolProperties poolProperties
    ) {
        this.connectionFactory = connectionFactory;
        this.poolProperties = poolProperties != null ? poolProperties : new JdbcPoolProperties();
    }

    public WarmupResult warmup(ConnectionEntity entity) {
        if (!usesJdbcPool(entity)) {
            return WarmupResult.skip();
        }
        int target = Math.max(1, poolProperties.getMinimumIdle());
        int parallelism = Math.min(MAX_WARMUP_PARALLELISM, target);
        ExecutorService executor = Executors.newFixedThreadPool(parallelism);
        try {
            List<Callable<Boolean>> tasks = new ArrayList<>(target);
            for (int attempt = 0; attempt < target; attempt++) {
                tasks.add(() -> borrowAndValidate(entity));
            }
            int warmed = 0;
            for (Future<Boolean> future : executor.invokeAll(tasks)) {
                try {
                    if (Boolean.TRUE.equals(future.get())) {
                        warmed++;
                    }
                } catch (ExecutionException ex) {
                    Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
                    if (cause instanceof SQLException sqlEx) {
                        ExceptionLogging.warn(
                                log,
                                "JDBC pool warmup failed connectionId=" + entity.getId(),
                                sqlEx
                        );
                    } else {
                        ExceptionLogging.warn(
                                log,
                                "JDBC pool warmup failed connectionId=" + entity.getId(),
                                cause instanceof Exception exception ? exception : ex
                        );
                    }
                    break;
                }
            }
            if (warmed > 0) {
                log.debug("Warmed JDBC pool connectionId={} connections={}/{}", entity.getId(), warmed, target);
            }
            return new WarmupResult(warmed, target);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new WarmupResult(0, target);
        } finally {
            executor.shutdownNow();
        }
    }

    private boolean borrowAndValidate(ConnectionEntity entity) throws SQLException {
        try (Connection connection = connectionFactory.open(entity)) {
            return connection.isValid(3);
        }
    }

    public static boolean usesJdbcPool(ConnectionEntity entity) {
        if (entity == null || entity.getId() == null || entity.getId().isBlank()) {
            return false;
        }
        String dbType = entity.getDbType();
        if (dbType == null || dbType.isBlank()) {
            return false;
        }
        return switch (dbType.toLowerCase()) {
            case "redis", "kafka", "mongodb" -> false;
            default -> true;
        };
    }

    public record WarmupResult(int warmed, int target, boolean skipped) {
        public static WarmupResult skip() {
            return new WarmupResult(0, 0, true);
        }

        public WarmupResult(int warmed, int target) {
            this(warmed, target, false);
        }
    }
}
