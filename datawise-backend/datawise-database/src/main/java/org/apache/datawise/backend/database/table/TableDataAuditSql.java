package org.apache.datawise.backend.database.table;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.dml.render.DmlSqlSupport;

import java.util.Map;
import java.util.stream.Collectors;

final class TableDataAuditSql {

    private TableDataAuditSql() {
    }

    static String buildSelectByPrimaryKey(
            String dbTypeId,
            String database,
            String tableName,
            Map<String, Object> primaryKeyValues
    ) {
        if (primaryKeyValues == null || primaryKeyValues.isEmpty()) {
            throw new IllegalArgumentException("primaryKeyValues is required");
        }
        String table = DbType.quoteQualifiedTable(dbTypeId, database, tableName);
        String where = primaryKeyValues.entrySet().stream()
                .map(entry -> DbType.quoteIdentifier(dbTypeId, entry.getKey())
                        + " = "
                        + DmlSqlSupport.sqlLiteral(entry.getValue()))
                .collect(Collectors.joining(" AND "));
        return "SELECT * FROM " + table + " WHERE " + where + " LIMIT 1";
    }
}
