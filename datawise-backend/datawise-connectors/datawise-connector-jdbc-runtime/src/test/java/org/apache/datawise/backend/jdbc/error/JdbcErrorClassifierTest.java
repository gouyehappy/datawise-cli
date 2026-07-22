package org.apache.datawise.backend.jdbc.error;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JdbcErrorClassifierTest {

    @Test
    void resolveErrorCode_mapsDriverLoadFailure() {
        Exception error = new Exception("No suitable driver found for jdbc:mysql://localhost/db");
        assertEquals(JdbcErrorClassifier.ERROR_CODE_JDBC_DRIVER_LOAD, JdbcErrorClassifier.resolveErrorCode(error));
        assertTrue(JdbcErrorClassifier.isDriverRelated(error));
    }

    @Test
    void resolveErrorCode_mapsWrappedDownloadFailure() {
        Exception root = new Exception("Connection timed out");
        Exception error = new Exception("Failed to download JDBC driver: Connection timed out", root);
        assertEquals(
                JdbcErrorClassifier.ERROR_CODE_JDBC_DRIVER_DOWNLOAD,
                JdbcErrorClassifier.resolveErrorCode(error)
        );
        assertTrue(JdbcErrorClassifier.isDriverRelated(error));
    }

    @Test
    void isTransientConnectionFailure_detectsConnectionReset() {
        assertTrue(JdbcErrorClassifier.isTransientConnectionFailure("connection reset by peer"));
    }
}
