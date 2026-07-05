package org.apache.datawise.backend.database.sql;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SqlResultCursorStore {

    private static final long TTL_MS = 30L * 60L * 1000L;

    private final ConcurrentHashMap<String, CursorEntry> entries = new ConcurrentHashMap<>();

    public record CursorEntry(
            long userId,
            String connectionId,
            String database,
            String sql,
            String sessionKey,
            int pageSize,
            int nextOffset,
            List<Map<String, Object>> columns,
            long createdAtMs
    ) {
    }

    public String create(
            long userId,
            String connectionId,
            String database,
            String sql,
            String sessionKey,
            int pageSize,
            int nextOffset,
            List<Map<String, Object>> columns
    ) {
        String id = UUID.randomUUID().toString();
        entries.put(
                id,
                new CursorEntry(
                        userId,
                        connectionId,
                        database,
                        sql,
                        sessionKey,
                        pageSize,
                        nextOffset,
                        columns,
                        System.currentTimeMillis()
                )
        );
        return id;
    }

    public CursorEntry require(long userId, String cursorId) {
        CursorEntry entry = entries.get(cursorId);
        if (entry == null) {
            throw new IllegalArgumentException("SQL cursor not found or expired");
        }
        if (entry.userId() != userId) {
            throw new IllegalArgumentException("SQL cursor not found or expired");
        }
        if (System.currentTimeMillis() - entry.createdAtMs() > TTL_MS) {
            entries.remove(cursorId);
            throw new IllegalArgumentException("SQL cursor not found or expired");
        }
        return entry;
    }

    public void updateOffset(String cursorId, int nextOffset) {
        entries.computeIfPresent(cursorId, (id, entry) -> new CursorEntry(
                entry.userId(),
                entry.connectionId(),
                entry.database(),
                entry.sql(),
                entry.sessionKey(),
                entry.pageSize(),
                nextOffset,
                entry.columns(),
                entry.createdAtMs()
        ));
    }

    public void remove(String cursorId) {
        entries.remove(cursorId);
    }
}
