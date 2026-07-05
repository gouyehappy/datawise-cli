package org.apache.datawise.backend.connector.api.support;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SqlWriteClassifierTest {

    @Test
    void treatsSelectAsReadOnly() {
        assertFalse(SqlWriteClassifier.requiresWriteAccess("SELECT * FROM users"));
        assertFalse(SqlWriteClassifier.requiresWriteAccess("WITH cte AS (SELECT 1) SELECT * FROM cte"));
        assertFalse(SqlWriteClassifier.requiresWriteAccess("EXPLAIN SELECT 1"));
    }

    @Test
    void treatsDmlAndDdlAsWrite() {
        assertTrue(SqlWriteClassifier.requiresWriteAccess("INSERT INTO t VALUES (1)"));
        assertTrue(SqlWriteClassifier.requiresWriteAccess("UPDATE t SET a = 1"));
        assertTrue(SqlWriteClassifier.requiresWriteAccess("DELETE FROM t"));
        assertTrue(SqlWriteClassifier.requiresWriteAccess("CREATE TABLE t (id INT)"));
    }

    @Test
    void treatsTransactionControlAsWrite() {
        assertTrue(SqlWriteClassifier.requiresWriteAccess("BEGIN"));
        assertTrue(SqlWriteClassifier.requiresWriteAccess("COMMIT"));
        assertTrue(SqlWriteClassifier.requiresWriteAccess("ROLLBACK"));
    }

    @Test
    void classifiesDdlStatements() {
        assertTrue(SqlWriteClassifier.requiresDdlAccess("CREATE TABLE t (id INT)"));
        assertTrue(SqlWriteClassifier.requiresDdlAccess("ALTER TABLE t ADD COLUMN x INT"));
        assertTrue(SqlWriteClassifier.requiresDdlAccess("DROP TABLE t"));
        assertFalse(SqlWriteClassifier.requiresDdlAccess("UPDATE t SET a = 1"));
        assertFalse(SqlWriteClassifier.requiresDdlAccess("INSERT INTO t VALUES (1)"));
    }

    @Test
    void classifiesDangerousSqlForConfirmation() {
        assertTrue(SqlWriteClassifier.requiresDangerousSqlConfirmation("DELETE FROM t"));
        assertTrue(SqlWriteClassifier.requiresDangerousSqlConfirmation("UPDATE t SET a = 1"));
        assertTrue(SqlWriteClassifier.requiresDangerousSqlConfirmation("TRUNCATE TABLE t"));
        assertTrue(SqlWriteClassifier.requiresDangerousSqlConfirmation("DROP TABLE t"));
        assertFalse(SqlWriteClassifier.requiresDangerousSqlConfirmation("INSERT INTO t VALUES (1)"));
        assertFalse(SqlWriteClassifier.requiresDangerousSqlConfirmation("CREATE TABLE t (id INT)"));
        assertFalse(SqlWriteClassifier.requiresDangerousSqlConfirmation("SELECT * FROM t"));
    }
}
