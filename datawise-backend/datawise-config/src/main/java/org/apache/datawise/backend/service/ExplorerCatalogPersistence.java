package org.apache.datawise.backend.service;

import org.apache.datawise.backend.configstore.ConnectionStore;
import org.apache.datawise.backend.configstore.SessionEphemeralCatalogStore;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.model.ConnectionGroupEntity;
import org.springframework.stereotype.Service;

/**
 * Explorer catalog 写路径：由 {@link UserResourcePolicy} 裁决访客会话 catalog vs 注册用户持久化。
 */
@Service
public class ExplorerCatalogPersistence {

    private final UserResourcePolicy resourcePolicy;
    private final SessionEphemeralCatalogStore ephemeralCatalogStore;
    private final ConnectionStore connectionStore;

    public ExplorerCatalogPersistence(
            UserResourcePolicy resourcePolicy,
            SessionEphemeralCatalogStore ephemeralCatalogStore,
            ConnectionStore connectionStore
    ) {
        this.resourcePolicy = resourcePolicy;
        this.ephemeralCatalogStore = ephemeralCatalogStore;
        this.connectionStore = connectionStore;
    }

    public void saveGroup(ConnectionGroupEntity group) {
        resourcePolicy.accessPolicy().runGuestEphemeralOrRegistered(
                () -> ephemeralCatalogStore.saveGroup(
                        resourcePolicy.requireSessionIdFor(UserResource.CONNECTION_CATALOG),
                        group
                ),
                () -> connectionStore.saveGroup(group)
        );
    }

    public void saveConnection(ConnectionEntity entity) {
        resourcePolicy.accessPolicy().runGuestEphemeralOrRegistered(
                () -> ephemeralCatalogStore.saveConnection(
                        resourcePolicy.requireSessionIdFor(UserResource.CONNECTION_CATALOG),
                        entity
                ),
                () -> connectionStore.saveConnection(entity)
        );
    }

    public void deleteConnection(String connectionId) {
        resourcePolicy.accessPolicy().runGuestEphemeralOrRegistered(
                () -> ephemeralCatalogStore.deleteConnectionById(
                        resourcePolicy.requireSessionIdFor(UserResource.CONNECTION_CATALOG),
                        connectionId
                ),
                () -> connectionStore.deleteConnectionById(connectionId)
        );
    }

    public void deleteGroupCascade(String groupId) {
        resourcePolicy.accessPolicy().runGuestEphemeralOrRegistered(
                () -> ephemeralCatalogStore.deleteGroupCascade(
                        resourcePolicy.requireSessionIdFor(UserResource.CONNECTION_CATALOG),
                        groupId
                ),
                () -> deleteRegisteredGroupCascade(groupId)
        );
    }

    private void deleteRegisteredGroupCascade(String groupId) {
        for (ConnectionGroupEntity child : connectionStore.findChildGroups(groupId)) {
            deleteRegisteredGroupCascade(child.getId());
        }
        for (ConnectionEntity connection : connectionStore.findConnectionsByGroupId(groupId)) {
            connectionStore.deleteConnectionById(connection.getId());
        }
        connectionStore.deleteGroupById(groupId);
    }
}
