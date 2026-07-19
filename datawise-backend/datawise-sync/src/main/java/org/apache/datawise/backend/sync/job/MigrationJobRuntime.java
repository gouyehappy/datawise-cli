package org.apache.datawise.backend.sync.job;

import org.apache.datawise.backend.sync.api.MigrationCancelledException;
import org.apache.datawise.backend.sync.api.MigrationExecutionControl;
import org.apache.datawise.backend.sync.api.MigrationPausedException;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/** 内存态：运行中 job 的暂停/取消信号与注册表。 */
@Component
public class MigrationJobRuntime {

    private final ConcurrentHashMap<String, AtomicBoolean> pauseRequested = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicBoolean> cancelRequested = new ConcurrentHashMap<>();
    private final ConcurrentHashMap.KeySetView<String, Boolean> runningJobs = ConcurrentHashMap.newKeySet();

    public void registerRunning(String jobId) {
        if (!tryRegisterRunning(jobId)) {
            throw new IllegalStateException("Migration job already running: " + jobId);
        }
    }

    /** @return false when the job id is already registered in this JVM */
    public boolean tryRegisterRunning(String jobId) {
        if (jobId == null || jobId.isBlank()) {
            return false;
        }
        if (!runningJobs.add(jobId)) {
            return false;
        }
        pauseRequested.put(jobId, new AtomicBoolean(false));
        cancelRequested.put(jobId, new AtomicBoolean(false));
        return true;
    }

    public void unregister(String jobId) {
        if (jobId == null || jobId.isBlank()) {
            return;
        }
        runningJobs.remove(jobId);
        pauseRequested.remove(jobId);
        cancelRequested.remove(jobId);
    }

    public boolean isRunning(String jobId) {
        return jobId != null && runningJobs.contains(jobId);
    }

    public void requestPause(String jobId) {
        if (jobId == null || jobId.isBlank()) {
            return;
        }
        pauseRequested.computeIfAbsent(jobId, ignored -> new AtomicBoolean(false)).set(true);
    }

    public void requestCancel(String jobId) {
        if (jobId == null || jobId.isBlank()) {
            return;
        }
        cancelRequested.computeIfAbsent(jobId, ignored -> new AtomicBoolean(false)).set(true);
        // Cancel supersedes pause: also set pause so any pause-only checks stop promptly.
        pauseRequested.computeIfAbsent(jobId, ignored -> new AtomicBoolean(false)).set(true);
    }

    public MigrationExecutionControl controlFor(String jobId) {
        if (jobId == null || jobId.isBlank()) {
            return MigrationExecutionControl.noop();
        }
        return () -> {
            AtomicBoolean cancel = cancelRequested.get(jobId);
            if (cancel != null && cancel.get()) {
                throw new MigrationCancelledException(jobId);
            }
            AtomicBoolean pause = pauseRequested.get(jobId);
            if (pause != null && pause.get()) {
                throw new MigrationPausedException(jobId);
            }
        };
    }
}
