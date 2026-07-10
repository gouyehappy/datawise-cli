package org.apache.datawise.backend.database.sql;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SqlResultCursorStore {

    private static final long TTL_MS = 30L * 60L * 1000L;
    private static final int MAX_CURSORS = 512;

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
            long lastAccessedAtMs
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
        evictExpired();
        if (entries.size() >= MAX_CURSORS) {
            evictOldest();
        }
        String id = UUID.randomUUID().toString();
        long now = System.currentTimeMillis();
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
                        now
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
        if (System.currentTimeMillis() - entry.lastAccessedAtMs() > TTL_MS) {
            entries.remove(cursorId);
            throw new IllegalArgumentException("SQL cursor not found or expired");
        }
        touch(cursorId, entry);
        return entries.get(cursorId);
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
                System.currentTimeMillis()
        ));
    }

    public void remove(String cursorId) {
        entries.remove(cursorId);
    }

    @Scheduled(fixedRate = 60_000)
    void evictExpiredScheduled() {
        evictExpired();
    }

    private void evictExpired() {
        long cutoff = System.currentTimeMillis() - TTL_MS;
        entries.entrySet().removeIf(entry -> entry.getValue().lastAccessedAtMs() < cutoff);
    }

    private void evictOldest() {
        entries.entrySet().stream()
                .min((left, right) -> Long.compare(
                        left.getValue().lastAccessedAtMs(),
                        right.getValue().lastAccessedAtMs()
                ))
                .ifPresent(oldest -> entries.remove(oldest.getKey()));
    }

    private void touch(String cursorId, CursorEntry entry) {
        entries.put(cursorId, new CursorEntry(
                entry.userId(),
                entry.connectionId(),
                entry.database(),
                entry.sql(),
                entry.sessionKey(),
                entry.pageSize(),
                entry.nextOffset(),
                entry.columns(),
                System.currentTimeMillis()
        ));
    }
}
