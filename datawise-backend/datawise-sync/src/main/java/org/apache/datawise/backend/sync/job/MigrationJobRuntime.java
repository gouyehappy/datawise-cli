package org.apache.datawise.backend.sync.job;

import org.apache.datawise.backend.sync.api.MigrationExecutionControl;
import org.apache.datawise.backend.sync.api.MigrationPausedException;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/** 内存态：运行中 job 的暂停信号与注册表。 */
@Component
public class MigrationJobRuntime {

    private final ConcurrentHashMap<String, AtomicBoolean> pauseRequested = new ConcurrentHashMap<>();
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
        return true;
    }

    public void unregister(String jobId) {
        if (jobId == null || jobId.isBlank()) {
            return;
        }
        runningJobs.remove(jobId);
        pauseRequested.remove(jobId);
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

    public MigrationExecutionControl controlFor(String jobId) {
        if (jobId == null || jobId.isBlank()) {
            return MigrationExecutionControl.noop();
        }
        return () -> {
            AtomicBoolean flag = pauseRequested.get(jobId);
            if (flag != null && flag.get()) {
                throw new MigrationPausedException(jobId);
            }
        };
    }
}
