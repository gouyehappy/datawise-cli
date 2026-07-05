package org.apache.datawise.backend.database.sql;

import org.apache.datawise.backend.database.context.ConnectionExecutionContext;

import org.apache.datawise.backend.connector.facade.ConnectorFacade;
import org.apache.datawise.backend.domain.ExecuteSqlResult;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.database.sql.QueryLimitResolver;
import org.apache.datawise.backend.database.sql.SqlExecutionSupport;
import org.springframework.stereotype.Service;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;

/** SQL 结果游标：分页 SELECT 首页、续页与 pageSize 解析。 */
@Service
public class SqlCursorService {

    static final int DEFAULT_PAGE_SIZE = 500;

    private final ConnectionExecutionContext connectionContext;
    private final ConnectorFacade connectorFacade;
    private final QueryLimitResolver queryLimitResolver;
    private final SqlResultCursorStore cursorStore;

    public SqlCursorService(
            ConnectionExecutionContext connectionContext,
            ConnectorFacade connectorFacade,
            QueryLimitResolver queryLimitResolver,
            SqlResultCursorStore cursorStore
    ) {
        this.connectionContext = connectionContext;
        this.connectorFacade = connectorFacade;
        this.queryLimitResolver = queryLimitResolver;
        this.cursorStore = cursorStore;
    }

    public ExecuteSqlResult fetchCursorPage(String cursorId, Integer pageSizeOverride) {
        long userId = connectionContext.requireUserId();
        SqlResultCursorStore.CursorEntry cursor = cursorStore.require(userId, cursorId);
        ConnectionExecutionContext.ResolvedConnection resolved = connectionContext.requireAvailableConnection(
                userId,
                cursor.connectionId(),
                "Connection not found: " + cursor.connectionId()
        );
        ConnectionEntity entity = resolved.entity();

        int pageSize = pageSizeOverride != null && pageSizeOverride > 0
                ? resolvePageSize(pageSizeOverride)
                : cursor.pageSize();

        try {
            ExecuteSqlResult page = connectorFacade.jdbc().executeSelectPage(
                    entity,
                    cursor.sql(),
                    cursor.database(),
                    pageSize,
                    cursor.nextOffset()
            );
            return finalizeCursorPage(cursorId, cursor, page);
        } catch (SQLException ex) {
            cursorStore.remove(cursorId);
            throw SqlExecutionSupport.toSqlExecutionException(entity, ex, cursor.sql());
        }
    }

    public ExecuteSqlResult executePagedFirstPage(
            long userId,
            ConnectionEntity entity,
            String database,
            String sql,
            Integer requestedPageSize
    ) {
        int pageSize = resolvePageSize(requestedPageSize);
        try {
            ExecuteSqlResult raw = connectorFacade.jdbc().execute(entity, sql, database, pageSize + 1);
            boolean hasMore = raw.rows().size() > pageSize;
            List<Map<String, Object>> rows = hasMore
                    ? List.copyOf(raw.rows().subList(0, pageSize))
                    : raw.rows();
            ExecuteSqlResult page = new ExecuteSqlResult(
                    raw.sql(),
                    rows.size(),
                    raw.durationMs(),
                    raw.columns(),
                    rows,
                    null,
                    null,
                    null,
                    hasMore,
                    0,
                    pageSize
            );
            if (!hasMore) {
                return page;
            }
            String cursorId = cursorStore.create(
                    userId,
                    entity.getId(),
                    database,
                    sql,
                    null,
                    pageSize,
                    rows.size(),
                    page.columns()
            );
            return SqlExecutionSupport.copyWithCursor(page, cursorId, true, 0, pageSize);
        } catch (SQLException ex) {
            throw SqlExecutionSupport.toSqlExecutionException(entity, ex, sql);
        }
    }

    public String createCursor(
            long userId,
            String connectionId,
            String database,
            String sql,
            int pageSize,
            int nextOffset,
            List<Map<String, Object>> columns
    ) {
        return cursorStore.create(userId, connectionId, database, sql, null, pageSize, nextOffset, columns);
    }

    public int resolvePageSize(Integer requestedPageSize) {
        int resolved = queryLimitResolver.resolve(requestedPageSize);
        return resolved > 0 ? resolved : DEFAULT_PAGE_SIZE;
    }

    private ExecuteSqlResult finalizeCursorPage(
            String cursorId,
            SqlResultCursorStore.CursorEntry cursor,
            ExecuteSqlResult page
    ) {
        int pageOffset = cursor.nextOffset();
        int pageSize = cursor.pageSize();
        if (!Boolean.TRUE.equals(page.hasMore())) {
            cursorStore.remove(cursorId);
            return SqlExecutionSupport.copyWithCursor(page, null, false, pageOffset, pageSize);
        }
        cursorStore.updateOffset(cursorId, pageOffset + page.rowCount());
        return SqlExecutionSupport.copyWithCursor(page, cursorId, true, pageOffset, pageSize);
    }
}
