package org.apache.datawise.backend.sync;

import org.apache.datawise.backend.config.TableMigrationProperties;
import org.apache.datawise.backend.configstore.migration.MigrationJobEntity;
import org.apache.datawise.backend.database.context.ConnectionExecutionContext;
import org.apache.datawise.backend.sync.api.MigrationExecutionControl;
import org.apache.datawise.backend.sync.api.MigrationPausedException;
import org.apache.datawise.backend.sync.api.TableMigrationProgressListener;
import org.apache.datawise.backend.sync.engine.MigrationEndpoints;
import org.apache.datawise.backend.sync.engine.TableMigrationBatchRequestPolicy;
import org.apache.datawise.backend.sync.engine.TableMigrationBatchPlan;
import org.apache.datawise.backend.sync.engine.TableMigrationExecutor;
import org.apache.datawise.backend.sync.engine.TableMigrationJobHooks;
import org.apache.datawise.backend.sync.engine.TableMigrationRequestPolicy;
import org.apache.datawise.backend.sync.job.MigrationJobCoordinator;
import org.apache.datawise.backend.sync.job.MigrationJobRuntime;
import org.apache.datawise.backend.sync.stream.MigrationJobStreamHub;
import org.apache.datawise.backend.sync.stream.TableMigrationStreamEmitter;
import org.apache.datawise.backend.sync.support.MigrationSupport;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.service.ConnectionAccessService;
import org.apache.datawise.backend.service.UserAccountService;

import org.apache.datawise.backend.domain.MigrationJobView;
import org.apache.datawise.backend.domain.TableMigrationBatchRequest;
import org.apache.datawise.backend.domain.TableMigrationBatchResult;
import org.apache.datawise.backend.domain.TableMigrationRequest;
import org.apache.datawise.backend.domain.TableMigrationResult;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

import org.springframework.beans.factory.annotation.Qualifier;

/** 表迁移门面：校验上下文后委托 {@link TableMigrationExecutor}。 */
@Service
public class TableMigrationService {

    private static final Logger log = LoggerFactory.getLogger(TableMigrationService.class);

    private final ConnectionExecutionContext connectionContext;
    private final UserAccountService userAccountService;
    private final ConnectionAccessService connectionAccessService;
    private final TableMigrationExecutor migrationExecutor;
    private final MigrationJobCoordinator jobCoordinator;
    private final MigrationJobRuntime jobRuntime;
    private final MigrationJobStreamHub jobStreamHub;
    private final TableMigrationProperties migrationProperties;
    private final Executor migrationJobTaskExecutor;

    public TableMigrationService(
            ConnectionExecutionContext connectionContext,
            UserAccountService userAccountService,
            ConnectionAccessService connectionAccessService,
            TableMigrationExecutor migrationExecutor,
            MigrationJobCoordinator jobCoordinator,
            MigrationJobRuntime jobRuntime,
            MigrationJobStreamHub jobStreamHub,
            TableMigrationProperties migrationProperties,
            @Qualifier("migrationJobTaskExecutor") Executor migrationJobTaskExecutor
    ) {
        this.connectionContext = connectionContext;
        this.userAccountService = userAccountService;
        this.connectionAccessService = connectionAccessService;
        this.migrationExecutor = migrationExecutor;
        this.jobCoordinator = jobCoordinator;
        this.jobRuntime = jobRuntime;
        this.jobStreamHub = jobStreamHub;
        this.migrationProperties = migrationProperties != null ? migrationProperties : new TableMigrationProperties();
        this.migrationJobTaskExecutor = migrationJobTaskExecutor != null ? migrationJobTaskExecutor : Runnable::run;
    }

    public TableMigrationResult migrateTable(TableMigrationRequest request) {
        TableMigrationRequestPolicy.validate(request);

        long userId = userAccountService.requireUserId();
        ConnectionEntity source = MigrationSupport.requireConnection(
                connectionContext,
                userId,
                request.sourceConnectionId()
        );
        ConnectionEntity target = MigrationSupport.requireConnection(
                connectionContext,
                userId,
                request.targetConnectionId()
        );
        connectionAccessService.requireWriteAccess(userId, request.targetConnectionId());

        String sourceDatabase = MigrationSupport.requireDatabase(source, request.sourceDatabase());
        String targetDatabase = MigrationSupport.requireDatabase(target, request.targetDatabase());
        MigrationSupport.requireDistinctScopes(
                request.sourceConnectionId(),
                sourceDatabase,
                request.targetConnectionId(),
                targetDatabase
        );

        return migrationExecutor.migrate(source, target, sourceDatabase, targetDatabase, request);
    }

    public TableMigrationBatchResult migrateTables(TableMigrationBatchRequest request) {
        return executeBatchMigration(request, null, MigrationExecutionControl.noop());
    }

    public TableMigrationBatchResult migrateTablesStream(
            TableMigrationBatchRequest request,
            TableMigrationProgressListener progressListener
    ) {
        return executeBatchMigration(request, progressListener, MigrationExecutionControl.noop());
    }

    public MigrationJobView getJob(String jobId) {
        long userId = userAccountService.requireUserId();
        return jobCoordinator.viewFor(userId, jobId);
    }

    public void openJobStream(String jobId, SseEmitter emitter) {
        long userId = userAccountService.requireUserId();
        MigrationJobView view = jobCoordinator.viewFor(userId, jobId);
        TableMigrationStreamEmitter.sendJobSnapshot(emitter, view);
        if (TableMigrationStreamEmitter.isTerminalJobStatus(view.status())) {
            TableMigrationStreamEmitter.sendTerminalJobEvent(emitter, view);
            TableMigrationStreamEmitter.completeSuccess(emitter);
            return;
        }
        jobStreamHub.subscribe(jobId, emitter);
    }

    public MigrationJobView startJobAsync(TableMigrationBatchRequest request) {
        long userId = userAccountService.requireUserId();
        validateBatchRequest(request);
        MigrationJobCoordinator.ExecutionContext execution = jobCoordinator.prepare(userId, request);
        String jobId = execution.jobId();
        if (!jobRuntime.tryRegisterRunning(jobId)) {
            throw new IllegalStateException("Migration job already running: " + jobId);
        }
        UserContext.Snapshot snapshot = UserContext.snapshotOrNull();
        TableMigrationProgressListener streamListener = jobStreamHub.progressListener(
                jobId,
                () -> jobCoordinator.viewFor(userId, jobId)
        );
        CompletableFuture.runAsync(() -> UserContext.runAs(snapshot, () -> {
            try {
                executePreparedBatch(execution, request, streamListener, jobRuntime.controlFor(jobId));
                MigrationJobView view = jobCoordinator.viewFor(userId, jobId);
                jobStreamHub.publishDone(jobId, view);
            } catch (MigrationPausedException ex) {
                flushCheckpoint(execution);
                jobCoordinator.markJobPaused(execution.job());
                MigrationJobView view = jobCoordinator.viewFor(userId, jobId);
                jobStreamHub.publishPaused(jobId, view);
            } catch (RuntimeException ex) {
                log.error("Migration job {} failed", jobId, ex);
                flushCheckpoint(execution);
                jobCoordinator.finalizeJobAfterFailure(execution.job(), ex);
                MigrationJobView view = jobCoordinator.viewFor(userId, jobId);
                jobStreamHub.publishDone(jobId, view);
            } finally {
                jobRuntime.unregister(jobId);
            }
            return null;
        }), migrationJobTaskExecutor);
        return jobCoordinator.viewFor(userId, jobId);
    }

    public MigrationJobView pauseJob(String jobId) {
        long userId = userAccountService.requireUserId();
        MigrationJobEntity job = jobCoordinator.requireOwnedJob(userId, jobId);
        if ("running".equals(job.getStatus())) {
            jobRuntime.requestPause(jobId);
        }
        if (!jobRuntime.isRunning(jobId) && "running".equals(job.getStatus())) {
            jobCoordinator.markJobPaused(job);
        }
        return jobCoordinator.viewFor(userId, jobId);
    }

    public MigrationJobView resumeJobAsync(String jobId) {
        long userId = userAccountService.requireUserId();
        MigrationJobEntity job = jobCoordinator.requireOwnedJob(userId, jobId);
        TableMigrationBatchRequest stored = job.getRequest();
        if (stored == null) {
            throw new IllegalArgumentException("Migration job request snapshot missing");
        }
        TableMigrationBatchRequest resumeRequest = new TableMigrationBatchRequest(
                stored.sourceConnectionId(),
                stored.sourceDatabase(),
                stored.targetConnectionId(),
                stored.targetDatabase(),
                stored.tables(),
                stored.mode(),
                stored.watermarkColumn(),
                stored.orderByColumns(),
                stored.whereClause(),
                stored.batchSize(),
                stored.throttleMs(),
                stored.truncateTarget(),
                jobId,
                jobId
        );
        return startJobAsync(resumeRequest);
    }

    private TableMigrationBatchResult executeBatchMigration(
            TableMigrationBatchRequest request,
            TableMigrationProgressListener progressListener,
            MigrationExecutionControl unusedControl
    ) {
        long userId = userAccountService.requireUserId();
        validateBatchRequest(request);
        MigrationJobCoordinator.ExecutionContext execution = jobCoordinator.prepare(userId, request);
        if (!jobRuntime.tryRegisterRunning(execution.jobId())) {
            throw new IllegalStateException("Migration job already running: " + execution.jobId());
        }
        MigrationExecutionControl executionControl = jobRuntime.controlFor(execution.jobId());
        try {
            return executePreparedBatch(execution, request, progressListener, executionControl);
        } catch (MigrationPausedException ex) {
            flushCheckpoint(execution);
            jobCoordinator.markJobPaused(execution.job());
            throw ex;
        } catch (RuntimeException ex) {
            log.error("Migration job {} failed", execution.jobId(), ex);
            flushCheckpoint(execution);
            jobCoordinator.finalizeJobAfterFailure(execution.job(), ex);
            throw ex;
        } finally {
            jobRuntime.unregister(execution.jobId());
        }
    }

    private void flushCheckpoint(MigrationJobCoordinator.ExecutionContext execution) {
        if (execution != null && execution.sink() != null) {
            execution.sink().flush();
        }
    }

    private TableMigrationBatchResult executePreparedBatch(
            MigrationJobCoordinator.ExecutionContext execution,
            TableMigrationBatchRequest request,
            TableMigrationProgressListener progressListener,
            MigrationExecutionControl executionControl
    ) {
        long userId = userAccountService.requireUserId();
        ConnectionEntity source = MigrationSupport.requireConnection(
                connectionContext,
                userId,
                request.sourceConnectionId()
        );
        ConnectionEntity target = MigrationSupport.requireConnection(
                connectionContext,
                userId,
                request.targetConnectionId()
        );
        connectionAccessService.requireWriteAccess(userId, request.targetConnectionId());

        String sourceDatabase = MigrationSupport.requireDatabase(source, request.sourceDatabase());
        String targetDatabase = MigrationSupport.requireDatabase(target, request.targetDatabase());
        MigrationSupport.requireDistinctScopes(
                request.sourceConnectionId(),
                sourceDatabase,
                request.targetConnectionId(),
                targetDatabase
        );

        MigrationEndpoints endpoints = new MigrationEndpoints(source, target, sourceDatabase, targetDatabase);
        TableMigrationBatchPlan plan = TableMigrationBatchPlan.from(request, migrationProperties.getDefaultBatchSize());
        TableMigrationJobHooks hooks = new TableMigrationJobHooks(
                progressListener,
                execution.sink(),
                executionControl,
                false
        );
        List<TableMigrationResult> results = migrationExecutor.migrateBatch(endpoints, plan, hooks);
        jobCoordinator.finalizeJob(execution.job(), results);
        return new TableMigrationBatchResult(execution.jobId(), results);
    }

    private void validateBatchRequest(TableMigrationBatchRequest request) {
        TableMigrationBatchRequestPolicy.validate(request, migrationProperties.getMaxBatchTables());
    }
}
