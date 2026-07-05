package org.apache.datawise.backend.connector.sqlserver.dml;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SqlServerFamilyDmlDialectTest {

    private final SqlServerFamilyDmlDialect dialect = new SqlServerFamilyDmlDialect();

    @Test
    void supportsSqlServerFamily() {
        assertTrue(dialect.supports("sqlserver"));
        assertTrue(dialect.supports("mssql"));
    }

    @Test
    void qualifiedTable_usesDatabaseDotDotTableSyntax() {
        assertEquals(
                "[AdventureWorks]..[Person]",
                dialect.qualifiedTable("AdventureWorks", "Person")
        );
    }

    @Test
    void quoteIdentifier_usesBrackets() {
        assertEquals("[user_name]", dialect.quoteIdentifier("user_name"));
    }
}
