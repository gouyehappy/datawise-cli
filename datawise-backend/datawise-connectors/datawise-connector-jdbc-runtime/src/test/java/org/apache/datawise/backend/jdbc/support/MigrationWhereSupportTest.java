package org.apache.datawise.backend.jdbc.support;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MigrationWhereSupportTest {

    @Test
    void acceptsSimpleWhereClause() {
        MigrationWhereSupport.validate("status = 1");
        assertEquals(
                "SELECT * FROM orders WHERE status = 1",
                MigrationWhereSupport.appendWhere("SELECT * FROM orders", "status = 1")
        );
    }

    @Test
    void rejectsUnsafeWhereClause() {
        assertThrows(IllegalArgumentException.class, () -> MigrationWhereSupport.validate("1=1; DROP TABLE t"));
        assertThrows(IllegalArgumentException.class, () -> MigrationWhereSupport.validate("id = 1 -- comment"));
    }

    @Test
    void detectsEqualScopes() {
        assertEquals(true, MigrationWhereSupport.scopesEqual("c1", "db1", "c1", "db1"));
        assertEquals(false, MigrationWhereSupport.scopesEqual("c1", "db1", "c1", "db2"));
    }
}
