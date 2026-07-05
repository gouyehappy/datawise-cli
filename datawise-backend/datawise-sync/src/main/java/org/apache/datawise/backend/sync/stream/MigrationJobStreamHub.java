package org.apache.datawise.backend.sync.stream;

import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.apache.datawise.backend.sync.api.TableMigrationProgressListener;
import org.apache.datawise.backend.domain.MigrationJobView;
import org.apache.datawise.backend.domain.TableMigrationResult;
import org.apache.datawise.backend.domain.TableMigrationTableBatchProgressEvent;
import org.apache.datawise.backend.domain.TableMigrationTableResultEvent;
import org.apache.datawise.backend.domain.TableMigrationTableStartEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/** 运行中迁移 job 的 SSE 订阅与事件广播。 */
@Component
public class MigrationJobStreamHub {

    private static final Logger log = LoggerFactory.getLogger(MigrationJobStreamHub.class);
    private static final long JOB_SNAPSHOT_THROTTLE_MS = 1_000L;

    private final ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> subscribers = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lastSnapshotPublishedAtMs = new ConcurrentHashMap<>();

    public void subscribe(String jobId, SseEmitter emitter) {
        if (jobId == null || jobId.isBlank() || emitter == null) {
            return;
        }
        CopyOnWriteArrayList<SseEmitter> emitters = subscribers.computeIfAbsent(jobId, ignored -> new CopyOnWriteArrayList<>());
        emitters.add(emitter);
        Runnable cleanup = () -> unsubscribe(jobId, emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(ignored -> cleanup.run());
    }

    public void unsubscribe(String jobId, SseEmitter emitter) {
        if (jobId == null || jobId.isBlank() || emitter == null) {
            return;
        }
        CopyOnWriteArrayList<SseEmitter> emitters = subscribers.get(jobId);
        if (emitters == null) {
            return;
        }
        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            subscribers.remove(jobId, emitters);
        }
    }

    public TableMigrationProgressListener progressListener(String jobId, Supplier<MigrationJobView> snapshotSupplier) {
        return new TableMigrationProgressListener() {
            @Override
            public void onTableStart(int tableIndex, int tableTotal, String tableName) {
                broadcast(jobId, "table_start", new TableMigrationTableStartEvent(tableIndex, tableTotal, tableName));
                publishSnapshot(jobId, snapshotSupplier);
            }

            @Override
            public void onTableResult(int tableIndex, int tableTotal, TableMigrationResult result) {
                broadcast(jobId, "table_result", new TableMigrationTableResultEvent(tableIndex, tableTotal, result));
                publishSnapshot(jobId, snapshotSupplier);
            }

            @Override
            public void onBatchProgress(
                    int tableIndex,
                    int tableTotal,
                    String tableName,
                    long offset,
                    long rowsMigrated,
                    int batches
            ) {
                broadcast(
                        jobId,
                        "batch_progress",
                        new TableMigrationTableBatchProgressEvent(
                                tableIndex,
                                tableTotal,
                                tableName,
                                offset,
                                rowsMigrated,
                                batches
                        )
                );
                publishSnapshotThrottled(jobId, snapshotSupplier);
            }
        };
    }

    public void publishSnapshot(String jobId, MigrationJobView view) {
        if (view == null) {
            return;
        }
        broadcast(jobId, "job_snapshot", view);
    }

    public void publishPaused(String jobId, MigrationJobView view) {
        lastSnapshotPublishedAtMs.remove(jobId);
        broadcast(jobId, "job_paused", view);
        completeAll(jobId);
    }

    public void publishDone(String jobId, MigrationJobView view) {
        lastSnapshotPublishedAtMs.remove(jobId);
        broadcast(jobId, "job_done", view);
        completeAll(jobId);
    }

    private void publishSnapshotThrottled(String jobId, Supplier<MigrationJobView> snapshotSupplier) {
        if (jobId == null || jobId.isBlank() || snapshotSupplier == null) {
            return;
        }
        long now = System.currentTimeMillis();
        Long last = lastSnapshotPublishedAtMs.get(jobId);
        if (last != null && now - last < JOB_SNAPSHOT_THROTTLE_MS) {
            return;
        }
        lastSnapshotPublishedAtMs.put(jobId, now);
        publishSnapshot(jobId, snapshotSupplier);
    }

    private void publishSnapshot(String jobId, Supplier<MigrationJobView> snapshotSupplier) {
        if (snapshotSupplier == null) {
            return;
        }
        try {
            MigrationJobView view = snapshotSupplier.get();
            if (view != null) {
                publishSnapshot(jobId, view);
            }
        } catch (RuntimeException ex) {
            ExceptionLogging.recoverable(log, "Migration job snapshot publish failed jobId=" + jobId, ex);
        }
    }

    private void broadcast(String jobId, String eventName, Object data) {
        CopyOnWriteArrayList<SseEmitter> emitters = subscribers.get(jobId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : List.copyOf(emitters)) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (IOException ex) {
                unsubscribe(jobId, emitter);
                ExceptionLogging.recoverable(log, "Migration job SSE send failed event=" + eventName, ex);
            } catch (IllegalStateException ex) {
                unsubscribe(jobId, emitter);
            }
        }
    }

    private void completeAll(String jobId) {
        CopyOnWriteArrayList<SseEmitter> emitters = subscribers.remove(jobId);
        if (emitters == null) {
            return;
        }
        for (SseEmitter emitter : emitters) {
            try {
                emitter.complete();
            } catch (Exception ex) {
                ExceptionLogging.recoverable(log, "Migration job SSE complete failed jobId=" + jobId, ex);
            }
        }
    }
}
