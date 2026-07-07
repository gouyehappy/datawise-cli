package org.apache.datawise.backend.common;

import org.apache.datawise.backend.common.ConnectionAccessDeniedException;
import org.apache.datawise.backend.common.DatabaseServiceException;
import org.apache.datawise.backend.common.ExplorerConnectionException;
import org.apache.datawise.backend.common.TableDataException;
import org.apache.datawise.backend.common.UnauthorizedException;
import org.apache.datawise.backend.ddl.DdlException;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.apache.datawise.backend.security.HeadlessMigrationAuth;
import org.apache.datawise.backend.service.UserAdminPolicy;
import org.apache.datawise.backend.jdbc.error.JdbcConnectionErrors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.io.IOException;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String INTERNAL_ERROR_MESSAGE = "Internal error";

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(SqlExecutionException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleSqlExecution(SqlExecutionException ex) {
        ExceptionLogging.warn(log, "SqlExecutionException", ex);
        Map<String, Object> data = new LinkedHashMap<>();
        if (ex.getErrorLine() != null) {
            data.put("errorLine", ex.getErrorLine());
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, ex.getMessage(), data.isEmpty() ? null : data));
    }

    @ExceptionHandler(DdlException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleDdlException(DdlException ex) {
        ExceptionLogging.warn(log, "DdlException [" + ex.errorCode() + "]", ex);
        Map<String, Object> data = new LinkedHashMap<>();
        if (ex.errorCode() != null) {
            data.put("errorCode", ex.errorCode().name());
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, ex.getMessage(), data.isEmpty() ? null : data));
    }

    @ExceptionHandler(ExplorerConnectionException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleExplorerConnection(ExplorerConnectionException ex) {
        ExceptionLogging.warn(log, "ExplorerConnectionException [" + ex.getErrorCode() + "]", ex);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, ex.getMessage(), ex.toResponseData()));
    }

    @ExceptionHandler(TableDataException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleTableData(TableDataException ex) {
        ExceptionLogging.warn(log, "TableDataException [" + ex.getErrorCode() + "]", ex);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, ex.getMessage(), ex.toResponseData()));
    }

    @ExceptionHandler(DatabaseServiceException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleDatabaseService(DatabaseServiceException ex) {
        ExceptionLogging.warn(log, "DatabaseServiceException [" + ex.getErrorCode() + "]", ex);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, ex.getMessage(), ex.toResponseData()));
    }

    @ExceptionHandler(ConnectionAccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleConnectionAccessDenied(ConnectionAccessDeniedException ex) {
        ExceptionLogging.warn(log, "ConnectionAccessDeniedException", ex);
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.fail(ConnectionAccessDeniedException.CODE));
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnauthorized(UnauthorizedException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.fail(UnauthorizedException.CODE));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        ExceptionLogging.warn(log, "IllegalArgumentException", ex);
        if (HeadlessMigrationAuth.API_TOKEN_FORBIDDEN.equals(ex.getMessage())
                || UserAdminPolicy.ADMIN_REQUIRED.equals(ex.getMessage())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.fail(ex.getMessage()));
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.fail(ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalState(IllegalStateException ex) {
        ExceptionLogging.error(log, "IllegalStateException", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.fail(INTERNAL_ERROR_MESSAGE));
    }

    @ExceptionHandler(SQLException.class)
    public ResponseEntity<ApiResponse<Void>> handleSqlException(SQLException ex) {
        ExceptionLogging.error(log, "Unhandled SQLException (should be converted in service layer)", ex);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.fail(JdbcConnectionErrors.toUserMessage(ex)));
    }

    @ExceptionHandler(IOException.class)
    public ResponseEntity<ApiResponse<Void>> handleIOException(IOException ex) {
        ExceptionLogging.warn(log, "IOException", ex);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.fail(ex.getMessage() != null ? ex.getMessage() : "IO error"));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<Void>> handleRuntime(RuntimeException ex) {
        ExceptionLogging.error(log, "RuntimeException", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.fail(INTERNAL_ERROR_MESSAGE));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneric(Exception ex) {
        ExceptionLogging.error(log, "Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.fail(INTERNAL_ERROR_MESSAGE));
    }
}
