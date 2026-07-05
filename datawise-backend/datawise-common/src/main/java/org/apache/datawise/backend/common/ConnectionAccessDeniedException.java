package org.apache.datawise.backend.common;

public class ConnectionAccessDeniedException extends RuntimeException {

    public static final String CODE = "CONNECTION_ACCESS_DENIED";

    public ConnectionAccessDeniedException(String connectionId) {
        super(CODE + (connectionId != null && !connectionId.isBlank() ? ":" + connectionId.trim() : ""));
    }
}
