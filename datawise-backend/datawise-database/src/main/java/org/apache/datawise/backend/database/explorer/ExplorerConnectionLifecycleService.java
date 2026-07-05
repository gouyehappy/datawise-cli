package org.apache.datawise.backend.database.explorer;

import org.apache.datawise.backend.connector.facade.ConnectorFacade;
import org.apache.datawise.backend.database.connection.JdbcConnectionPoolWarmupService;
import org.apache.datawise.backend.database.context.ConnectionExecutionContext;
import org.apache.datawise.backend.domain.ConnectionTestResult;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.common.support.PerfLogger;
import org.apache.datawise.backend.jdbc.support.JdbcDriverConnectionFactory;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Explorer 连接生命周期：断开池/会话、探测连通性、重连。 */
@Service
public class ExplorerConnectionLifecycleService {

    private static final Logger log = LoggerFactory.getLogger(ExplorerConnectionLifecycleService.class);

    private final ConnectionExecutionContext connectionContext;
    private final ConnectorFacade connectorFacade;
    private final JdbcDriverConnectionFactory jdbcDriverConnectionFactory;
    private final ExplorerSchemaSessionPool schemaSessionPool;
    private final ExplorerTreeBuilder treeBuilder;
    private final JdbcConnectionPoolWarmupService poolWarmupService;

    public ExplorerConnectionLifecycleService(
            ConnectionExecutionContext connectionContext,
            ConnectorFacade connectorFacade,
            JdbcDriverConnectionFactory jdbcDriverConnectionFactory,
            ExplorerSchemaSessionPool schemaSessionPool,
            ExplorerTreeBuilder treeBuilder,
            JdbcConnectionPoolWarmupService poolWarmupService
    ) {
        this.connectionContext = connectionContext;
        this.connectorFacade = connectorFacade;
        this.jdbcDriverConnectionFactory = jdbcDriverConnectionFactory;
        this.schemaSessionPool = schemaSessionPool;
        this.treeBuilder = treeBuilder;
        this.poolWarmupService = poolWarmupService;
    }

    public void disconnect(String connectionId) {
        requireAvailableConnection(connectionId);
        jdbcDriverConnectionFactory.evictPool(connectionId);
        schemaSessionPool.invalidate(connectionId);
        treeBuilder.saveSchemaChildren(connectionId, List.of());
    }

    public ConnectionTestResult ping(String connectionId) {
        ConnectionEntity entity = requireAvailableConnection(connectionId);
        long startedAt = System.currentTimeMillis();
        ConnectionTestResult result = connectorFacade.catalog().pingConnection(entity);
        PerfLogger.log(
                log,
                "connection.ping",
                startedAt,
                "connectionId", connectionId,
                "ok", result.ok(),
                "probeMs", result.latencyMs()
        );
        return result;
    }

    public ConnectionTestResult connect(String connectionId) {
        ConnectionEntity entity = requireAvailableConnection(connectionId);
        long startedAt = System.currentTimeMillis();
        if (JdbcConnectionPoolWarmupService.usesJdbcPool(entity)) {
            JdbcConnectionPoolWarmupService.WarmupResult warmup = poolWarmupService.warmup(entity);
            long latency = System.currentTimeMillis() - startedAt;
            if (warmup.warmed() > 0) {
                ConnectionTestResult result = new ConnectionTestResult(
                        true,
                        String.format(
                                "Connected to %s (pool warmed %d/%d) in %dms",
                                entity.getName(),
                                warmup.warmed(),
                                warmup.target(),
                                latency
                        ),
                        latency
                );
                PerfLogger.log(
                        log,
                        "connection.connect",
                        startedAt,
                        "connectionId", connectionId,
                        "ok", true,
                        "probeMs", latency,
                        "poolWarmed", warmup.warmed(),
                        "poolWarmTarget", warmup.target()
                );
                return result;
            }
        }
        ConnectionTestResult result = connectorFacade.catalog().pingConnection(entity);
        JdbcConnectionPoolWarmupService.WarmupResult warmup = JdbcConnectionPoolWarmupService.WarmupResult.skip();
        if (result.ok() && JdbcConnectionPoolWarmupService.usesJdbcPool(entity)) {
            warmup = poolWarmupService.warmup(entity);
        }
        PerfLogger.log(
                log,
                "connection.connect",
                startedAt,
                "connectionId", connectionId,
                "ok", result.ok(),
                "probeMs", result.latencyMs(),
                "poolWarmed", warmup.skipped() ? 0 : warmup.warmed(),
                "poolWarmTarget", warmup.skipped() ? 0 : warmup.target()
        );
        return result;
    }

    public ConnectionTestResult reconnect(String connectionId) {
        long startedAt = System.currentTimeMillis();
        disconnect(connectionId);
        ConnectionTestResult result = connect(connectionId);
        PerfLogger.log(
                log,
                "connection.reconnect",
                startedAt,
                "connectionId", connectionId,
                "ok", result.ok(),
                "probeMs", result.latencyMs()
        );
        return result;
    }

    private ConnectionEntity requireAvailableConnection(String connectionId) {
        return connectionContext.requireAvailableConnectionForCurrentUser(
                connectionId,
                ConnectionExecutionContext.EXPLORER_CONNECTION_NOT_FOUND
        ).entity();
    }
}
