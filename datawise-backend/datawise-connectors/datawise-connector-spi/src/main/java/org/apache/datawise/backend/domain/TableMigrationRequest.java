package org.apache.datawise.backend.domain;

import java.util.List;

public record TableMigrationRequest(
        String sourceConnectionId,
        String sourceDatabase,
        String targetConnectionId,
        String targetDatabase,
        String tableName,
        String mode,
        String watermarkColumn,
        List<String> orderByColumns,
        String whereClause,
        Integer batchSize,
        Integer throttleMs,
        Boolean truncateTarget,
        Boolean createTargetIfMissing,
        String sourceSelectSql,
        String targetTableName,
        String conflictStrategy
) {
}
