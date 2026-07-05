package org.apache.datawise.backend.database.sql;

import org.apache.datawise.backend.database.context.ConnectionExecutionContext;
import org.apache.datawise.backend.service.ConnectionAccessService;



import org.apache.datawise.backend.connector.facade.ConnectorFacade;
import org.apache.datawise.backend.connector.hook.SqlExecutionHookRunner;

import org.apache.datawise.backend.connector.support.ConnectorCapabilityGuard;

import org.apache.datawise.backend.connector.facade.jdbc.ConnectorJdbcSessionAccess;

import org.apache.datawise.backend.domain.ExecuteSqlRequest;

import org.apache.datawise.backend.domain.ExecuteSqlResult;

import org.apache.datawise.backend.model.ConnectionEntity;

import org.apache.datawise.backend.database.sql.QueryLimitResolver;

import org.apache.datawise.backend.database.sql.SqlExecutionSupport;

import org.apache.datawise.backend.connector.api.support.SqlSelectDetector;

import org.slf4j.Logger;

import org.slf4j.LoggerFactory;

import org.springframework.stereotype.Service;



import java.sql.SQLException;



/** SQL 控制台单次执行：校验、鉴权、手动会话与可取消执行。 */

@Service

public class SqlExecuteService {



    private static final Logger log = LoggerFactory.getLogger(SqlExecuteService.class);



    private final ConnectionExecutionContext connectionContext;

    private final ConnectorFacade connectorFacade;

    private final QueryLimitResolver queryLimitResolver;

    private final ConnectionAccessService connectionAccessService;

    private final SqlCursorService sqlCursorService;

    private final SqlExecutionHookRunner sqlExecutionHookRunner;



    public SqlExecuteService(

            ConnectionExecutionContext connectionContext,

            ConnectorFacade connectorFacade,

            QueryLimitResolver queryLimitResolver,

            ConnectionAccessService connectionAccessService,

            SqlCursorService sqlCursorService,

            SqlExecutionHookRunner sqlExecutionHookRunner

    ) {

        this.connectionContext = connectionContext;

        this.connectorFacade = connectorFacade;

        this.queryLimitResolver = queryLimitResolver;

        this.connectionAccessService = connectionAccessService;

        this.sqlCursorService = sqlCursorService;

        this.sqlExecutionHookRunner = sqlExecutionHookRunner;

    }



    public ExecuteSqlResult execute(ExecuteSqlRequest request) {

        if (request.cursorId() != null && !request.cursorId().isBlank()) {

            return sqlCursorService.fetchCursorPage(request.cursorId(), request.pageSize());

        }



        String trimmed = request.sql() != null ? request.sql().trim() : "";

        if (trimmed.isEmpty()) {

            throw new IllegalArgumentException("SQL is required");

        }

        if (request.connectionId() == null || request.connectionId().isBlank()) {

            throw new IllegalArgumentException("connectionId is required");

        }



        ConnectionExecutionContext.ResolvedConnection resolved = connectionContext.requireAvailableConnectionForCurrentUser(

                request.connectionId(),

                "Connection not found: " + request.connectionId()

        );

        long userId = resolved.userId();

        ConnectionEntity entity = resolved.entity();

        connectionAccessService.requireSqlWriteAccess(userId, request.connectionId(), trimmed);

        ConnectorCapabilityGuard.requireSqlExecute(connectorFacade, entity);

        String database = ConnectionExecutionContext.resolveDatabase(entity, request.database());

        final String sqlToExecute = sqlExecutionHookRunner.applyBeforeExecute(
                trimmed,
                request.connectionId(),
                database,
                userId
        );

        ConnectorJdbcSessionAccess session = connectorFacade.jdbc().session();



        boolean manualSession = session.requireManualSession(userId, request.sessionKey()) != null;

        Integer pageSize = request.pageSize();

        if (!manualSession && pageSize != null && pageSize > 0 && SqlSelectDetector.isPagedSelect(sqlToExecute)) {

            return sqlCursorService.executePagedFirstPage(userId, entity, database, sqlToExecute, pageSize);

        }



        int resolvedMaxRows = queryLimitResolver.resolve(request.maxRows());

        String executionKey = resolveExecutionKey(userId, request.sessionKey());



        try {

            log.debug("SqlExecuteService.execute connectionId={} database={} sessionKey={} sqlPreview={}",

                    request.connectionId(),

                    database,

                    request.sessionKey(),

                    sqlToExecute.length() > 120 ? sqlToExecute.substring(0, 120) + "..." : sqlToExecute);



            if (manualSession) {

                ExecuteSqlResult sessionResult = session.executeInManualSession(

                        userId,

                        request.sessionKey(),

                        entity,

                        database,

                        sqlToExecute,

                        resolvedMaxRows,

                        executionKey

                );

                if (sessionResult != null) {

                    return sessionResult;

                }

            }



            if (executionKey != null) {

                long startedAt = System.currentTimeMillis();

                ExecuteSqlResult result = connectorFacade.jdbc().withConnection(

                        entity,

                        database,

                        connection -> connectorFacade.jdbc().executeOnConnection(

                                connection,

                                sqlToExecute,

                                resolvedMaxRows,

                                executionKey

                        )

                );

                return SqlExecutionSupport.withDuration(result, System.currentTimeMillis() - startedAt);

            }



            return connectorFacade.jdbc().execute(entity, sqlToExecute, database, resolvedMaxRows);

        } catch (SQLException ex) {

            log.warn("SqlExecuteService.execute failed connectionId={} database={} message={}",

                    request.connectionId(),

                    database,

                    ex.getMessage());

            throw SqlExecutionSupport.toSqlExecutionException(entity, ex, sqlToExecute);

        }

    }



    private static String resolveExecutionKey(long userId, String sessionKey) {

        if (sessionKey == null || sessionKey.isBlank()) {

            return null;

        }

        return ConsoleSqlCancelService.executionKey(userId, sessionKey);

    }

}

