package org.apache.datawise.backend.connector.oracle.schema;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OracleSchemaDialectTest {

    private final OracleSchemaDialect dialect = new OracleSchemaDialect();

    @Test
    void filtersSystemSchemas() {
        assertTrue(dialect.isSystemSchema("SYS"));
        assertTrue(dialect.isSystemSchema("APEX_040000"));
        assertFalse(dialect.isSystemSchema("HR"));
    }
}
