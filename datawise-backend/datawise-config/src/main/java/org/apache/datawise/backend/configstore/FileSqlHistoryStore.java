package org.apache.datawise.backend.configstore;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.domain.TenantIds;
import org.apache.datawise.backend.model.SqlHistoryEntity;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@ConditionalOnProperty(prefix = "datawise.storage", name = "backend", havingValue = "file", matchIfMissing = true)
public class FileSqlHistoryStore implements SqlHistoryStore {

    private final JsonListFile<SqlHistoryEntity> sqlHistory;

    public FileSqlHistoryStore(ConfigDirectoryService configDirectory, ObjectMapper objectMapper) {
        this.sqlHistory = new JsonListFile<>(
                configDirectory, objectMapper, ConfigPaths.SQL_HISTORY, new TypeReference<>() {
        });
    }

    @Override
    public List<SqlHistoryEntity> findByUserId(Long userId) {
        String tenantId = TenantScopedConfigSupport.currentTenantId();
        return sqlHistory.stream()
                .filter(item -> userId.equals(item.getUserId()) && matchesTenant(item.getTenantId(), tenantId))
                .sorted(Comparator.comparing(SqlHistoryEntity::getExecutedAt).reversed())
                .toList();
    }

    @Override
    public List<SqlHistoryEntity> findByUserIds(List<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return List.of();
        }
        Set<Long> idSet = new HashSet<>(userIds);
        String tenantId = TenantScopedConfigSupport.currentTenantId();
        return sqlHistory.stream()
                .filter(item -> idSet.contains(item.getUserId()) && matchesTenant(item.getTenantId(), tenantId))
                .sorted(Comparator.comparing(SqlHistoryEntity::getExecutedAt).reversed())
                .toList();
    }

    @Override
    public SqlHistoryEntity save(SqlHistoryEntity entity) {
        if (entity.getTenantId() == null || entity.getTenantId().isBlank()) {
            entity.setTenantId(TenantScopedConfigSupport.currentTenantId());
        }
        return sqlHistory.append(entity);
    }

    static boolean matchesTenant(String entityTenantId, String currentTenantId) {
        return TenantIds.normalizeOrDefault(currentTenantId)
                .equals(TenantIds.normalizeOrDefault(entityTenantId));
    }
}
