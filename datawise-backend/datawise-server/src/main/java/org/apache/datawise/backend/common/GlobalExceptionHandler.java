package org.apache.datawise.backend.common;

import org.apache.datawise.backend.ddl.DdlException;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.apache.datawise.backend.security.ClientErrorMessageSupport;
import org.apache.datawise.backend.security.HeadlessMigrationAuth;
import org.apache.datawise.backend.service.UserAdminPolicy;
import org.apache.datawise.backend.service.UserPermissionPolicy;
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
        data.put("errorCode", DatawiseErrorCodes.SQL_EXECUTION_FAILED);
        if (ex.getErrorLine() != null) {
            data.put("errorLine", ex.getErrorLine());
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, ClientErrorMessageSupport.sqlExecutionMessage(ex.getMessage()), data));
    }

    @ExceptionHandler(DdlException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleDdlException(DdlException ex) {
        ExceptionLogging.warn(log, "DdlException [" + ex.errorCode() + "]", ex);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("errorCode", ex.errorCode() != null ? ex.errorCode().name() : DatawiseErrorCodes.DDL);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, ex.getMessage(), data));
    }

    @ExceptionHandler(ExplorerConnectionException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleExplorerConnection(ExplorerConnectionException ex) {
        ExceptionLogging.warn(log, "ExplorerConnectionException [" + ex.getErrorCode() + "]", ex);
        Map<String, Object> data = ex.toResponseData();
        if (data == null) {
            data = new LinkedHashMap<>();
        } else {
            data = new LinkedHashMap<>(data);
        }
        data.putIfAbsent("errorCode", ex.getErrorCode() != null ? ex.getErrorCode() : DatawiseErrorCodes.EXPLORER_CONNECTION);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, ex.getMessage(), data));
    }

    @ExceptionHandler(TableDataException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleTableData(TableDataException ex) {
        ExceptionLogging.warn(log, "TableDataException [" + ex.getErrorCode() + "]", ex);
        Map<String, Object> data = ex.toResponseData();
        if (data == null) {
            data = new LinkedHashMap<>();
        } else {
            data = new LinkedHashMap<>(data);
        }
        data.putIfAbsent("errorCode", ex.getErrorCode() != null ? ex.getErrorCode() : DatawiseErrorCodes.TABLE_DATA);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, ex.getMessage(), data));
    }

    @ExceptionHandler(DatabaseServiceException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleDatabaseService(DatabaseServiceException ex) {
        ExceptionLogging.warn(log, "DatabaseServiceException [" + ex.getErrorCode() + "]", ex);
        Map<String, Object> data = ex.toResponseData();
        if (data == null) {
            data = new LinkedHashMap<>();
        } else {
            data = new LinkedHashMap<>(data);
        }
        data.putIfAbsent("errorCode", ex.getErrorCode() != null ? ex.getErrorCode() : DatawiseErrorCodes.DATABASE_SERVICE);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, ex.getMessage(), data));
    }

    @ExceptionHandler(ConnectionAccessDeniedException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleConnectionAccessDenied(ConnectionAccessDeniedException ex) {
        ExceptionLogging.warn(log, "connection.access.denied", ex);
        Map<String, Object> data = Map.of("errorCode", DatawiseErrorCodes.CONNECTION_ACCESS_DENIED);
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiResponse<>(-1, ConnectionAccessDeniedException.CODE, data));
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleUnauthorized(UnauthorizedException ex) {
        Map<String, Object> data = Map.of("errorCode", DatawiseErrorCodes.UNAUTHORIZED);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse<>(-1, UnauthorizedException.CODE, data));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleIllegalArgument(IllegalArgumentException ex) {
        ExceptionLogging.warn(log, "IllegalArgumentException", ex);
        if (HeadlessMigrationAuth.API_TOKEN_FORBIDDEN.equals(ex.getMessage())
                || UserAdminPolicy.ADMIN_REQUIRED.equals(ex.getMessage())
                || UserPermissionPolicy.PERMISSION_DENIED.equals(ex.getMessage())) {
            Map<String, Object> data = Map.of("errorCode", ex.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ApiResponse<>(-1, ex.getMessage(), data));
        }
        Map<String, Object> data = Map.of("errorCode", DatawiseErrorCodes.BAD_REQUEST);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, ClientErrorMessageSupport.forClient(ex.getMessage()), data));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleIllegalState(IllegalStateException ex) {
        ExceptionLogging.error(log, "IllegalStateException", ex);
        Map<String, Object> data = Map.of("errorCode", DatawiseErrorCodes.INTERNAL_ERROR);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse<>(-1, INTERNAL_ERROR_MESSAGE, data));
    }

    @ExceptionHandler(SQLException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleSqlException(SQLException ex) {
        ExceptionLogging.error(log, "Unhandled SQLException (should be converted in service layer)", ex);
        Map<String, Object> data = Map.of("errorCode", DatawiseErrorCodes.SQL_EXECUTION_FAILED);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, JdbcConnectionErrors.toUserMessage(ex), data));
    }

    @ExceptionHandler(IOException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleIOException(IOException ex) {
        ExceptionLogging.warn(log, "IOException", ex);
        Map<String, Object> data = Map.of("errorCode", DatawiseErrorCodes.IO_ERROR);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiResponse<>(-1, ClientErrorMessageSupport.ioMessage(), data));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleRuntime(RuntimeException ex) {
        ExceptionLogging.error(log, "RuntimeException", ex);
        Map<String, Object> data = Map.of("errorCode", DatawiseErrorCodes.INTERNAL_ERROR);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse<>(-1, INTERNAL_ERROR_MESSAGE, data));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleGeneric(Exception ex) {
        ExceptionLogging.error(log, "Unhandled exception", ex);
        Map<String, Object> data = Map.of("errorCode", DatawiseErrorCodes.INTERNAL_ERROR);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse<>(-1, INTERNAL_ERROR_MESSAGE, data));
    }
}
