package org.apache.datawise.backend.sync.api;

import org.apache.datawise.backend.domain.TableMigrationResult;

/** 批量迁移逐表进度回调（SSE 等场景）。 */
public interface TableMigrationProgressListener {

    void onTableStart(int tableIndex, int tableTotal, String tableName);

    void onTableResult(int tableIndex, int tableTotal, TableMigrationResult result);

    default void onBatchProgress(
            int tableIndex,
            int tableTotal,
            String tableName,
            long offset,
            long rowsMigrated,
            int batches
    ) {
    }
}
