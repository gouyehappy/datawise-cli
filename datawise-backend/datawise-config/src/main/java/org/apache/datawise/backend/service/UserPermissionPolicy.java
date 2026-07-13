package org.apache.datawise.backend.service;

import org.apache.datawise.backend.domain.UserFeaturePermission;
import org.apache.datawise.backend.model.UserEntity;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 用户功能权限：admin 始终全量；其它账号按 users.json 配置或默认策略裁决。
 */
@Service
public class UserPermissionPolicy {

    public static final String PERMISSION_DENIED = "PERMISSION_DENIED";

    private final UserAdminPolicy adminPolicy;

    public UserPermissionPolicy(UserAdminPolicy adminPolicy) {
        this.adminPolicy = adminPolicy;
    }

    public Map<String, Boolean> resolveEffectivePermissions(UserEntity user) {
        if (user == null || user.getId() == null) {
            return UserFeaturePermission.workbenchPreset();
        }
        if (adminPolicy.isAdminUser(user.getId())) {
            return UserFeaturePermission.fullPreset();
        }
        Map<String, Boolean> stored = user.getFeaturePermissions();
        if (stored == null || stored.isEmpty()) {
            return user.isGuest()
                    ? UserFeaturePermission.workbenchPreset()
                    : UserFeaturePermission.fullPreset();
        }
        return normalizeStoredPermissions(stored);
    }

    public boolean hasPermission(UserEntity user, String feature) {
        if (feature == null || feature.isBlank()) {
            return false;
        }
        return resolveEffectivePermissions(user).getOrDefault(feature.trim(), false);
    }

    public void requirePermission(UserEntity user, String feature) {
        if (!hasPermission(user, feature)) {
            throw new IllegalArgumentException(PERMISSION_DENIED);
        }
    }

    public Map<String, Boolean> sanitizeUpdate(Map<String, Boolean> requested) {
        Map<String, Boolean> normalized = UserFeaturePermission.workbenchPreset();
        if (requested == null) {
            return normalized;
        }
        for (String key : UserFeaturePermission.ALL) {
            Boolean granted = requested.get(key);
            if (granted != null) {
                normalized.put(key, granted);
            }
        }
        return normalized;
    }

    private Map<String, Boolean> normalizeStoredPermissions(Map<String, Boolean> stored) {
        Map<String, Boolean> normalized = new LinkedHashMap<>(UserFeaturePermission.workbenchPreset());
        for (Map.Entry<String, Boolean> entry : stored.entrySet()) {
            if (entry.getKey() == null || !UserFeaturePermission.ALL.contains(entry.getKey())) {
                continue;
            }
            normalized.put(entry.getKey(), Boolean.TRUE.equals(entry.getValue()));
        }
        return normalized;
    }
}
