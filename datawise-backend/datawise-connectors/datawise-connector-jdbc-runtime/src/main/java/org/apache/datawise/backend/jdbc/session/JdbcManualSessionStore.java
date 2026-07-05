package org.apache.datawise.backend.jdbc.session;

import org.apache.datawise.backend.domain.SqlSessionStatus;

import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/** 控制台手动 JDBC 会话的内存存储。 */
@Component
public class JdbcManualSessionStore {

    private final Map<String, ManagedSession> sessions = new ConcurrentHashMap<>();

    public SqlSessionStatus getStatus(long userId, String sessionKey) {
        ManagedSession session = sessions.get(key(userId, sessionKey));
        if (session == null) {
            return SqlSessionStatus.idle(null, null);
        }
        return session.toStatus();
    }

    public ManagedSession get(long userId, String sessionKey) {
        return sessions.get(key(userId, sessionKey));
    }

    public ManagedSession getOrCreate(long userId, String sessionKey, String connectionId, String database) {
        return sessions.computeIfAbsent(
                key(userId, sessionKey),
                ignored -> new ManagedSession(connectionId, database)
        );
    }

    /** 连接被 abort 后清掉会话内引用，避免后续 SQL 复用已失效连接。 */
    public void invalidateConnection(String executionKey) {
        int colon = executionKey.indexOf(':');
        if (colon <= 0 || colon >= executionKey.length() - 1) {
            return;
        }
        try {
            long userId = Long.parseLong(executionKey.substring(0, colon));
            String sessionKey = executionKey.substring(colon + 1);
            ManagedSession session = sessions.get(key(userId, sessionKey));
            if (session == null) {
                return;
            }
            session.lock.lock();
            try {
                session.connection = null;
            } finally {
                session.lock.unlock();
            }
        } catch (NumberFormatException ignored) {
            // not a console execution key
        }
    }

    public ManagedSession requireSession(long userId, String sessionKey) {
        ManagedSession session = sessions.get(key(userId, sessionKey));
        if (session == null || session.connection == null) {
            throw new IllegalStateException("SQL session not found or already closed");
        }
        return session;
    }

    public ManagedSession requireManualSession(long userId, String sessionKey) {
        ManagedSession session = sessions.get(key(userId, sessionKey));
        if (session == null || session.autocommit) {
            return null;
        }
        return session;
    }

    public ManagedSession remove(long userId, String sessionKey) {
        return sessions.remove(key(userId, sessionKey));
    }

    public void markPending(long userId, String sessionKey) {
        ManagedSession session = sessions.get(key(userId, sessionKey));
        if (session != null && !session.autocommit) {
            session.pending = true;
        }
    }

    public static String key(long userId, String sessionKey) {
        return userId + ":" + sessionKey;
    }

    public static final class ManagedSession {
        public final ReentrantLock lock = new ReentrantLock(true);
        public Connection connection;
        public String connectionId;
        public String database;
        public boolean autocommit = true;
        public boolean pending;

        ManagedSession(String connectionId, String database) {
            this.connectionId = connectionId;
            this.database = database;
        }

        public SqlSessionStatus toStatus() {
            return new SqlSessionStatus(autocommit, pending, connectionId, database);
        }
    }
}
