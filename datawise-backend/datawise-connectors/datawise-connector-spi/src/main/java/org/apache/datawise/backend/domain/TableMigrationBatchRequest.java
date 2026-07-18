package org.apache.datawise.backend.domain;

import java.util.List;

public record TableMigrationBatchRequest(
        String sourceConnectionId,
        String sourceDatabase,
        String targetConnectionId,
        String targetDatabase,
        List<TableMigrationBatchTableRequest> tables,
        String mode,
        String watermarkColumn,
        List<String> orderByColumns,
        String whereClause,
        Integer batchSize,
        Integer throttleMs,
        Boolean truncateTarget,
        String jobId,
        String resumeJobId,
        String conflictStrategy
) {
}
