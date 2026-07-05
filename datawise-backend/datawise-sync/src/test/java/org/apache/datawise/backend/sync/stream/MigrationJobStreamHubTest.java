package org.apache.datawise.backend.sync.stream;

import org.apache.datawise.backend.domain.MigrationJobView;
import org.apache.datawise.backend.domain.TableMigrationResult;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MigrationJobStreamHubTest {

    @Test
    void publishDone_completesSubscribers() {
        MigrationJobStreamHub hub = new MigrationJobStreamHub();
        TestEmitter emitter = new TestEmitter();
        hub.subscribe("job-1", emitter);

        hub.publishDone("job-1", sampleView("completed"));

        assertTrue(emitter.completed);
    }

    @Test
    void progressListener_throttlesJobSnapshotOnBatchProgress() {
        MigrationJobStreamHub hub = new MigrationJobStreamHub();
        CountingEmitter emitter = new CountingEmitter();
        hub.subscribe("job-throttle", emitter);
        var listener = hub.progressListener("job-throttle", () -> sampleView("running"));

        listener.onBatchProgress(1, 2, "users", 500, 500, 1);
        listener.onBatchProgress(1, 2, "users", 1000, 1000, 2);

        assertEquals(3, emitter.sendCount);
    }

    @Test
    void progressListener_runsWithoutSubscribers() {
        MigrationJobStreamHub hub = new MigrationJobStreamHub();
        var listener = hub.progressListener("job-2", () -> sampleView("running"));
        assertDoesNotThrow(() -> {
            listener.onTableStart(1, 2, "users");
            listener.onBatchProgress(1, 2, "users", 500, 500, 1);
            listener.onTableResult(1, 2, new TableMigrationResult(
                    "users", 500, 1, 10, "success", null, null, null, null, null
            ));
        });
    }

    private static MigrationJobView sampleView(String status) {
        return new MigrationJobView(
                "job-1",
                status,
                List.of("users"),
                Map.of(),
                List.of(),
                Instant.parse("2026-06-01T00:00:00Z"),
                Instant.parse("2026-06-01T00:00:01Z")
        );
    }

    private static final class TestEmitter extends SseEmitter {
        private boolean completed;

        TestEmitter() {
            super(60_000L);
        }

        @Override
        public void complete() {
            completed = true;
            super.complete();
        }
    }

    private static final class CountingEmitter extends SseEmitter {
        private int sendCount;

        CountingEmitter() {
            super(60_000L);
        }

        @Override
        public synchronized void send(SseEventBuilder builder) {
            sendCount++;
        }
    }
}
