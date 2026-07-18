package org.apache.datawise.backend.configstore.jdbc;

import org.apache.datawise.backend.configstore.TenantAiUsageStore;
import org.apache.datawise.backend.domain.TenantIds;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Service
@ConditionalOnProperty(prefix = "datawise.storage", name = "backend", havingValue = "jdbc")
public class JdbcTenantAiUsageStore implements TenantAiUsageStore {

    private final JdbcTemplate jdbc;

    public JdbcTenantAiUsageStore(@Qualifier(MetadataJdbcConfiguration.METADATA_JDBC) JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public AiUsageSnapshot read(String tenantId) {
        String id = TenantIds.normalizeOrDefault(tenantId);
        List<AiUsageSnapshot> rows = jdbc.query(
                "SELECT usage_day, call_count FROM dw_tenant_ai_usage WHERE tenant_id = ?",
                (rs, rowNum) -> new AiUsageSnapshot(rs.getString("usage_day"), rs.getInt("call_count")),
                id
        );
        if (rows.isEmpty()) {
            return emptyToday();
        }
        AiUsageSnapshot stored = rows.get(0);
        return stored.day != null ? stored : emptyToday();
    }

    @Override
    public synchronized void write(String tenantId, AiUsageSnapshot usage) {
        String id = TenantIds.normalizeOrDefault(tenantId);
        AiUsageSnapshot next = usage != null ? usage : emptyToday();
        String day = next.day != null && !next.day.isBlank()
                ? next.day
                : LocalDate.now(ZoneId.systemDefault()).toString();
        int calls = Math.max(0, next.calls);
        Timestamp now = Timestamp.from(Instant.now());
        int updated = jdbc.update(
                "UPDATE dw_tenant_ai_usage SET usage_day = ?, call_count = ?, updated_at = ? WHERE tenant_id = ?",
                day, calls, now, id
        );
        if (updated == 0) {
            jdbc.update(
                    "INSERT INTO dw_tenant_ai_usage (tenant_id, usage_day, call_count, updated_at) VALUES (?,?,?,?)",
                    id, day, calls, now
            );
        }
    }

    private static AiUsageSnapshot emptyToday() {
        return new AiUsageSnapshot(LocalDate.now(ZoneId.systemDefault()).toString(), 0);
    }
}
