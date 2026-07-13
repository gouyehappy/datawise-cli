package org.apache.datawise.backend.service;

import org.apache.datawise.backend.configstore.UserStore;
import org.apache.datawise.backend.domain.UpdateUserPermissionsRequest;
import org.apache.datawise.backend.domain.UserPermissionSummaryDto;
import org.apache.datawise.backend.model.UserEntity;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
public class UserAdminService {

    public static final String CANNOT_MODIFY_ADMIN = "CANNOT_MODIFY_ADMIN_PERMISSIONS";

    private final UserStore userStore;
    private final UserAdminPolicy adminPolicy;
    private final UserPermissionPolicy permissionPolicy;

    public UserAdminService(
            UserStore userStore,
            UserAdminPolicy adminPolicy,
            UserPermissionPolicy permissionPolicy
    ) {
        this.userStore = userStore;
        this.adminPolicy = adminPolicy;
        this.permissionPolicy = permissionPolicy;
    }

    public List<UserPermissionSummaryDto> listUsers() {
        adminPolicy.requireAdminUser();
        return userStore.listAllUsers().stream()
                .sorted(Comparator.comparing(UserEntity::getId))
                .map(this::toSummary)
                .toList();
    }

    public UserPermissionSummaryDto updateUserPermissions(long userId, UpdateUserPermissionsRequest request) {
        adminPolicy.requireAdminUser();
        if (adminPolicy.isAdminUser(userId)) {
            throw new IllegalArgumentException(CANNOT_MODIFY_ADMIN);
        }
        UserEntity user = userStore.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("USER_NOT_FOUND"));
        Map<String, Boolean> next = permissionPolicy.sanitizeUpdate(
                request != null ? request.featurePermissions() : null
        );
        user.setFeaturePermissions(next);
        user.setUpdatedAt(Instant.now());
        userStore.saveUser(user);
        Map<String, Boolean> effective = permissionPolicy.resolveEffectivePermissions(user);
        user.setFeaturePermissions(effective);
        userStore.saveUser(user);
        return toSummary(user);
    }

    private UserPermissionSummaryDto toSummary(UserEntity user) {
        return new UserPermissionSummaryDto(
                user.getId(),
                user.getUsername(),
                user.getDisplayName() != null && !user.getDisplayName().isBlank()
                        ? user.getDisplayName()
                        : user.getUsername(),
                user.isGuest(),
                adminPolicy.isAdminUser(user.getId()),
                permissionPolicy.resolveEffectivePermissions(user)
        );
    }
}
