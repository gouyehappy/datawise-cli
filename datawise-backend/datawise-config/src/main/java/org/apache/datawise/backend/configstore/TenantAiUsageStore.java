package org.apache.datawise.backend.configstore;

/** Per-tenant daily AI call counter (file or jdbc backend). */
public interface TenantAiUsageStore {

    AiUsageSnapshot read(String tenantId);

    void write(String tenantId, AiUsageSnapshot usage);

    final class AiUsageSnapshot {
        public String day;
        public int calls;

        public AiUsageSnapshot() {
        }

        public AiUsageSnapshot(String day, int calls) {
            this.day = day;
            this.calls = calls;
        }
    }
}
