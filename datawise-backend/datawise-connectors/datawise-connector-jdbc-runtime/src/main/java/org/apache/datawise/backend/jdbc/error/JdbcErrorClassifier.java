package org.apache.datawise.backend.jdbc.error;

/** JDBC 异常分类：瞬断、驱动、连接池等。 */
public final class JdbcErrorClassifier {

    public static final String ERROR_CODE_JDBC_DRIVER = "JDBC_DRIVER_REQUIRED";
    public static final String ERROR_CODE_JDBC_DRIVER_LOAD = "JDBC_DRIVER_LOAD_FAILED";
    public static final String ERROR_CODE_DATABASE_CONNECTION = "DATABASE_CONNECTION_FAILED";

    private JdbcErrorClassifier() {
    }

    public static boolean isPoolUnavailable(Throwable error) {
        return isTransientConnectionFailure(error);
    }

    public static boolean isTransientConnectionFailure(Throwable error) {
        String message = rootMessage(error);
        return message != null && isTransientConnectionFailure(message.toLowerCase());
    }

    public static boolean isTransientConnectionFailure(String lowerMessage) {
        if (isPoolAcquireTimeout(lowerMessage)) {
            return true;
        }
        if (isPostgresqlIoFailure(lowerMessage)) {
            return true;
        }
        return lowerMessage.contains("connection reset")
                || lowerMessage.contains("broken pipe")
                || lowerMessage.contains("connection has been closed")
                || lowerMessage.contains("connection closed")
                || lowerMessage.contains("socket closed")
                || lowerMessage.contains("terminating connection")
                || lowerMessage.contains("server closed the connection")
                || lowerMessage.contains("connection is closed")
                || lowerMessage.contains("no operations allowed after connection closed");
    }

    public static boolean isDriverRelated(Throwable error) {
        String message = rootMessage(error);
        if (message == null) {
            return false;
        }
        String lower = message.toLowerCase();
        return lower.contains("no suitable driver")
                || lower.contains("driverclass is required")
                || lower.contains("jdbc driver maven coordinates are required")
                || lower.contains("failed to download driver")
                || isLocalLoadFailure(lower);
    }

    public static String classifyErrorCode(Throwable error) {
        if (error == null) {
            return null;
        }
        String message = rootMessage(error);
        if (message == null || message.isBlank()) {
            return null;
        }
        String lower = message.toLowerCase();
        if (lower.contains("driverclass is required")
                || lower.contains("jdbc driver maven coordinates are required")) {
            return ERROR_CODE_JDBC_DRIVER;
        }
        if (isDriverRelated(error)) {
            if (isLocalLoadFailure(lower) || lower.contains("no suitable driver")) {
                return ERROR_CODE_JDBC_DRIVER_LOAD;
            }
            return ERROR_CODE_JDBC_DRIVER;
        }
        return null;
    }

    public static String resolveErrorCode(Throwable error) {
        String message = rootMessage(error);
        if (message == null || message.isBlank()) {
            return ERROR_CODE_DATABASE_CONNECTION;
        }
        String lower = message.toLowerCase();
        if (lower.contains("driverclass is required")
                || lower.contains("jdbc driver maven coordinates are required")) {
            return ERROR_CODE_JDBC_DRIVER;
        }
        if (isDriverRelated(error)) {
            return ERROR_CODE_JDBC_DRIVER_LOAD;
        }
        return ERROR_CODE_DATABASE_CONNECTION;
    }

    public static boolean isPostgresqlIoFailure(String lowerMessage) {
        return lowerMessage.contains("an i/o error occurred while sending to the backend")
                || lowerMessage.contains("i/o error occurred while sending to the backend");
    }

    public static boolean isPoolAcquireTimeout(String lowerMessage) {
        return lowerMessage.contains("connection is not available")
                && lowerMessage.contains("request timed out");
    }

    public static boolean isLocalLoadFailure(String lowerMessage) {
        return lowerMessage.contains("failed to load driver class")
                || lowerMessage.contains("failed to initialize jdbc pool")
                || lowerMessage.contains("failed to load jdbc driver")
                || lowerMessage.contains("failed to preload jdbc driver");
    }

    public static String rootMessage(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current.getMessage();
    }
}
