package org.apache.datawise.backend.service;

import org.apache.datawise.backend.configstore.ConfigDirectoryService;
import org.apache.datawise.backend.configstore.UserStore;
import org.apache.datawise.backend.domain.UserFeaturePermission;
import org.apache.datawise.backend.model.UserEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserPermissionPolicyTest {

    @TempDir
    Path tempDir;

    private UserPermissionPolicy policy;
    private UserAdminPolicy adminPolicy;

    @BeforeEach
    void setUp() {
        ConfigDirectoryService configDirectory = new ConfigDirectoryService(tempDir);
        UserStore userStore = new UserStore(configDirectory, new ObjectMapper());
        adminPolicy = new UserAdminPolicy(userStore, new UserAccessPolicy());
        policy = new UserPermissionPolicy(adminPolicy);

        userStore.saveUser(user("admin", 1L, false));
        userStore.saveUser(user("demo", 2L, false));
        userStore.saveUser(user("guest", 3L, true));
    }

    @Test
    void adminAlwaysHasFullPermissions() {
        UserEntity admin = user("admin", 1L, false);
        Map<String, Boolean> permissions = policy.resolveEffectivePermissions(admin);
        assertTrue(permissions.get(UserFeaturePermission.NAV_SETTINGS));
        assertTrue(permissions.get(UserFeaturePermission.NAV_AI));
    }

    @Test
    void registeredUserWithoutOverridesGetsFullPermissions() {
        UserEntity demo = user("demo", 2L, false);
        assertTrue(policy.hasPermission(demo, UserFeaturePermission.NAV_DASHBOARD));
    }

    @Test
    void guestWithoutOverridesGetsWorkbenchPreset() {
        UserEntity guest = user("guest", 3L, true);
        assertTrue(policy.hasPermission(guest, UserFeaturePermission.NAV_DATABASE));
        assertFalse(policy.hasPermission(guest, UserFeaturePermission.NAV_DASHBOARD));
        assertFalse(policy.hasPermission(guest, UserFeaturePermission.NAV_SETTINGS));
    }

    @Test
    void storedPermissionsOverrideDefaults() {
        UserEntity demo = user("demo", 2L, false);
        demo.setFeaturePermissions(Map.of(
                UserFeaturePermission.NAV_DATABASE, true,
                UserFeaturePermission.NAV_DASHBOARD, false
        ));
        assertTrue(policy.hasPermission(demo, UserFeaturePermission.NAV_DATABASE));
        assertFalse(policy.hasPermission(demo, UserFeaturePermission.NAV_DASHBOARD));
    }

    @Test
    void sanitizeUpdatePersistsWorkbenchExplorerAdd() {
        Map<String, Boolean> updated = policy.sanitizeUpdate(Map.of(
                UserFeaturePermission.WORKBENCH_EXPLORER_ADD, true
        ));
        assertTrue(updated.get(UserFeaturePermission.WORKBENCH_EXPLORER_ADD));
    }

    @Test
    void guestStoredPermissionsCanGrantExplorerAdd() {
        UserEntity guest = user("guest", 3L, true);
        guest.setFeaturePermissions(Map.of(
                UserFeaturePermission.WORKBENCH_EXPLORER_ADD, true
        ));
        assertTrue(policy.hasPermission(guest, UserFeaturePermission.WORKBENCH_EXPLORER_ADD));
        assertFalse(policy.hasPermission(guest, UserFeaturePermission.NAV_DASHBOARD));
    }

    private static UserEntity user(String username, long id, boolean guest) {
        UserEntity entity = new UserEntity();
        entity.setId(id);
        entity.setUsername(username);
        entity.setDisplayName(username);
        entity.setEmail(username + "@datawise.local");
        entity.setGuest(guest);
        if (!guest) {
            entity.setPasswordHash("test-hash");
        }
        return entity;
    }
}
