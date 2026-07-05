package org.apache.datawise.backend.configstore;

import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.security.UserContext;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Explorer schema 浏览缓存（进程内存，按 session + connection 隔离，不写盘）。
 */
@Service
public class SchemaCacheStore {

    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> versions = new ConcurrentHashMap<>();

    public List<TreeNode> load(String connectionId) {
        return load(connectionId, Long.MAX_VALUE);
    }

    public List<TreeNode> load(String connectionId, long ttlMs) {
        CacheEntry entry = cache.get(cacheKey(connectionId));
        if (entry == null) {
            return List.of();
        }
        if (isExpired(entry, ttlMs)) {
            String key = cacheKey(connectionId);
            cache.remove(key, entry);
            return List.of();
        }
        return copyNodes(entry.nodes());
    }

    public synchronized void save(String connectionId, List<TreeNode> children) {
        String key = cacheKey(connectionId);
        cache.put(key, new CacheEntry(copyNodes(children != null ? children : List.of()), Instant.now()));
        versions.merge(key, 1L, Long::sum);
    }

    public long version(String connectionId) {
        return versions.getOrDefault(cacheKey(connectionId), 0L);
    }

    public void clear(String connectionId) {
        String key = cacheKey(connectionId);
        cache.remove(key);
        versions.remove(key);
    }

    public void clearSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }
        String prefix = sessionId.trim() + ":";
        cache.keySet().removeIf(key -> {
            if (!key.startsWith(prefix)) {
                return false;
            }
            versions.remove(key);
            return true;
        });
    }

    private static boolean isExpired(CacheEntry entry, long ttlMs) {
        if (ttlMs <= 0 || ttlMs == Long.MAX_VALUE) {
            return false;
        }
        return Instant.now().toEpochMilli() - entry.cachedAt().toEpochMilli() > ttlMs;
    }

    private static String cacheKey(String connectionId) {
        String sessionId = UserContext.getSessionId();
        String scope = sessionId != null && !sessionId.isBlank() ? sessionId.trim() : "anonymous";
        return scope + ":" + connectionId;
    }

    private static List<TreeNode> copyNodes(List<TreeNode> nodes) {
        return new ArrayList<>(nodes);
    }

    private record CacheEntry(List<TreeNode> nodes, Instant cachedAt) {
    }

    public record SchemaCachePayload(List<TreeNode> children, String refreshedAt) {
    }
}
