package org.apache.datawise.backend.service;

import org.apache.datawise.backend.common.UnauthorizedException;
import org.apache.datawise.backend.configstore.UserStore;
import org.apache.datawise.backend.model.UserEntity;
import org.apache.datawise.backend.security.UserContext;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.Optional;

/**
 * 单机部署下的管理员判定：id 最小的非 guest 用户（通常为 bootstrap {@code admin}）。
 */
@Service
public class UserAdminPolicy {

    public static final String ADMIN_REQUIRED = "ADMIN_REQUIRED";

    private final UserStore userStore;
    private final UserAccessPolicy accessPolicy;

    public UserAdminPolicy(UserStore userStore, UserAccessPolicy accessPolicy) {
        this.userStore = userStore;
        this.accessPolicy = accessPolicy;
    }

    public void requireAdminUser() {
        accessPolicy.requireRegisteredUser();
        if (UserContext.isApiTokenAuth()) {
            throw new UnauthorizedException();
        }
        if (!isAdminUser(accessPolicy.requireUserId())) {
            throw new IllegalArgumentException(ADMIN_REQUIRED);
        }
    }

    public boolean isAdminUser(long userId) {
        return resolveAdminUserId().map(adminId -> adminId == userId).orElse(false);
    }

    private Optional<Long> resolveAdminUserId() {
        return userStore.listRegisteredUsers().stream()
                .min(Comparator.comparing(UserEntity::getId))
                .map(UserEntity::getId);
    }
}
