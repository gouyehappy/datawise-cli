package org.apache.datawise.backend.common;

/**
 * Stable client-facing error codes shared by REST and AI SSE payloads.
 */
public final class DatawiseErrorCodes {

    public static final String UNAUTHORIZED = UnauthorizedException.CODE;
    public static final String FORBIDDEN = "FORBIDDEN";
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";
    public static final String BAD_REQUEST = "BAD_REQUEST";
    public static final String SQL_EXECUTION_FAILED = "SQL_EXECUTION_FAILED";
    public static final String IO_ERROR = "IO_ERROR";
    public static final String QUERY_ROW_LIMIT = "QUERY_ROW_LIMIT";

    public static final String EXPLORER_CONNECTION = "EXPLORER_CONNECTION";
    public static final String TABLE_DATA = "TABLE_DATA";
    public static final String DATABASE_SERVICE = "DATABASE_SERVICE";
    public static final String DDL = "DDL";
    public static final String CONNECTION_ACCESS_DENIED = ConnectionAccessDeniedException.CODE;
    public static final String SQL_PRODUCTION_APPROVAL_REQUIRED = ProductionWriteBlockedException.CODE;

    private DatawiseErrorCodes() {
    }
}
