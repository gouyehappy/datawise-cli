package org.apache.datawise.backend.service;

import org.springframework.stereotype.Service;

/**
 * 用户资源策略：单一事实来源，裁决各资源的读写与隔离范围。
 * <p>
 * 业务层通过 {@link #canRead(UserResource)} / {@link #requireWrite(UserResource)} 访问资源，
 * 避免在 Controller/Store 中按功能散落 guest 判断。
 */
@Service
public class UserResourcePolicy {

    public enum StorageScope {
        NONE,
        SESSION_EPHEMERAL,
        USER,
        GLOBAL
    }

    public record ResourceRule(
            StorageScope serverScope,
            boolean guestReadable,
            boolean guestWritable
    ) {
    }

    private final UserAccessPolicy accessPolicy;

    public UserResourcePolicy(UserAccessPolicy accessPolicy) {
        this.accessPolicy = accessPolicy;
    }

    public ResourceRule rule(UserResource resource) {
        return switch (resource) {
            case LAYOUT_MENU, APP_CONFIG, AI_PREFERENCES, SQL_SNIPPETS_PERSONAL, WORKSPACE_SCRIPTS,
                    WORKSPACE_USER_DATA ->
                    new ResourceRule(StorageScope.USER, true, false);
            case AI_KNOWLEDGE, AI_ANALYSIS_CANVAS, SEMANTIC_METRICS, FEDERATED_VIEWS,
                    SCHEMA_DRIFT_MONITORS, SCHEDULED_TASKS ->
                    new ResourceRule(StorageScope.USER, true, false);
            case CONNECTION_CATALOG ->
                    new ResourceRule(StorageScope.SESSION_EPHEMERAL, true, true);
            case SQL_SNIPPETS_SHARED, UPDATER_PREFERENCES ->
                    new ResourceRule(StorageScope.GLOBAL, true, false);
            case CONNECTIONS_XML_BULK ->
                    new ResourceRule(StorageScope.GLOBAL, true, false);
        };
    }

    public boolean canRead(UserResource resource) {
        ResourceRule rule = rule(resource);
        if (accessPolicy.isGuestSession()) {
            return rule.guestReadable();
        }
        return true;
    }

    public boolean canWrite(UserResource resource) {
        ResourceRule rule = rule(resource);
        if (accessPolicy.isGuestSession()) {
            return rule.guestWritable();
        }
        return true;
    }

    public void requireWrite(UserResource resource) {
        if (!canWrite(resource)) {
            throw new IllegalArgumentException(UserAccessPolicy.GUEST_NOT_ALLOWED);
        }
        if (!accessPolicy.isGuestSession()) {
            accessPolicy.requireRegisteredUser();
        }
    }

    public long readUserIdFor(UserResource resource) {
        if (!canRead(resource)) {
            throw new IllegalArgumentException(UserAccessPolicy.GUEST_NOT_ALLOWED);
        }
        return accessPolicy.requireUserId();
    }

    public long requireRegisteredUserIdFor(UserResource resource) {
        requireWrite(resource);
        return accessPolicy.requireRegisteredUserId();
    }

    public String requireSessionIdFor(UserResource resource) {
        if (!canRead(resource)) {
            throw new IllegalArgumentException(UserAccessPolicy.GUEST_NOT_ALLOWED);
        }
        return accessPolicy.requireSessionId();
    }

    public boolean isGuestSession() {
        return accessPolicy.isGuestSession();
    }

    public UserAccessPolicy accessPolicy() {
        return accessPolicy;
    }
}
