package org.apache.datawise.backend.database.explorer;

import org.apache.datawise.backend.database.context.ConnectionExecutionContext;
import org.apache.datawise.backend.database.connection.DatasourceCatalogService;
import org.apache.datawise.backend.database.connection.JdbcConnectionPoolWarmupService;
import org.apache.datawise.backend.connector.api.support.ConnectionMapper;
import org.apache.datawise.backend.domain.ConnectionConfig;
import org.apache.datawise.backend.domain.ConnectionResult;
import org.apache.datawise.backend.domain.ImportConnectionsResult;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.model.ConnectionGroupEntity;
import org.apache.datawise.backend.common.support.IdGenerator;
import org.apache.datawise.backend.jdbc.support.JdbcDriverConnectionFactory;
import org.apache.datawise.backend.service.ConnectionVisibilityService;
import org.apache.datawise.backend.service.ConnectionWritePolicy;
import org.apache.datawise.backend.service.ExplorerCatalogPersistence;
import org.apache.datawise.backend.service.UserResource;
import org.apache.datawise.backend.service.UserResourcePolicy;
import org.springframework.stereotype.Service;

import java.util.List;

/** Explorer 连接节点 CRUD 与批量导入。 */
@Service
public class ExplorerNodeAdminService {

    private final ExplorerTreeBuilder treeBuilder;
    private final ConnectionExecutionContext connectionContext;
    private final DatasourceCatalogService datasourceCatalogService;
    private final JdbcDriverConnectionFactory jdbcDriverConnectionFactory;
    private final ExplorerGroupService groupService;
    private final ExplorerSchemaSessionPool schemaSessionPool;
    private final ConnectionVisibilityService connectionVisibilityService;
    private final ConnectionWritePolicy connectionWritePolicy;
    private final ExplorerCatalogPersistence catalogPersistence;
    private final UserResourcePolicy resourcePolicy;
    private final JdbcConnectionPoolWarmupService poolWarmupService;

    public ExplorerNodeAdminService(
            ExplorerTreeBuilder treeBuilder,
            ConnectionExecutionContext connectionContext,
            DatasourceCatalogService datasourceCatalogService,
            JdbcDriverConnectionFactory jdbcDriverConnectionFactory,
            ExplorerGroupService groupService,
            ExplorerSchemaSessionPool schemaSessionPool,
            ConnectionVisibilityService connectionVisibilityService,
            ConnectionWritePolicy connectionWritePolicy,
            ExplorerCatalogPersistence catalogPersistence,
            UserResourcePolicy resourcePolicy,
            JdbcConnectionPoolWarmupService poolWarmupService
    ) {
        this.treeBuilder = treeBuilder;
        this.connectionContext = connectionContext;
        this.datasourceCatalogService = datasourceCatalogService;
        this.jdbcDriverConnectionFactory = jdbcDriverConnectionFactory;
        this.groupService = groupService;
        this.schemaSessionPool = schemaSessionPool;
        this.connectionVisibilityService = connectionVisibilityService;
        this.connectionWritePolicy = connectionWritePolicy;
        this.catalogPersistence = catalogPersistence;
        this.resourcePolicy = resourcePolicy;
        this.poolWarmupService = poolWarmupService;
    }

    public ConnectionResult createConnection(ConnectionConfig config, String groupId) {
        datasourceCatalogService.requireAvailable(config.getDbType());
        Long userId = connectionContext.requireUserId();
        String targetGroupId = groupId != null ? groupId : groupService.defaultGroupId();
        ConnectionGroupEntity group = connectionVisibilityService.resolveGroupEntity(targetGroupId)
                .orElseThrow(() -> new IllegalArgumentException("EXPLORER_GROUP_NOT_FOUND"));

        String connectionId = IdGenerator.shortId("conn-");
        ConnectionEntity entity = ConnectionMapper.fromDto(config, userId, group.getId(), connectionId);
        entity.setSortOrder(connectionVisibilityService.connectionsForGroup(group.getId()).size());
        persistConnection(entity);
        treeBuilder.saveSchemaChildren(connectionId, List.of());
        poolWarmupService.warmupInBackground(entity);
        return new ConnectionResult(connectionId, groupService.buildGroupTree());
    }

    public List<TreeNode> updateConnection(String connectionId, ConnectionConfig config) {
        datasourceCatalogService.requireAvailable(config.getDbType());
        connectionWritePolicy.requireConnectionWritable(connectionId);
        ConnectionEntity entity = connectionContext.requireConnection(
                connectionContext.requireUserId(),
                connectionId,
                ConnectionExecutionContext.EXPLORER_CONNECTION_NOT_FOUND
        ).entity();
        ConnectionMapper.applyDto(entity, config);
        persistConnection(entity);
        schemaSessionPool.invalidate(connectionId);
        jdbcDriverConnectionFactory.evictPool(connectionId);
        treeBuilder.saveSchemaChildren(connectionId, List.of());
        poolWarmupService.warmupInBackground(entity);
        return groupService.buildGroupTree();
    }

    public List<TreeNode> deleteConnection(String connectionId) {
        connectionWritePolicy.requireConnectionWritable(connectionId);
        catalogPersistence.deleteConnection(connectionId);
        schemaSessionPool.invalidate(connectionId);
        jdbcDriverConnectionFactory.evictPool(connectionId);
        return groupService.buildGroupTree();
    }

    public List<TreeNode> moveConnection(String connectionId, String targetGroupId) {
        connectionWritePolicy.requireConnectionWritable(connectionId);
        ConnectionGroupEntity group = connectionVisibilityService.resolveGroupEntity(targetGroupId)
                .orElseThrow(() -> new IllegalArgumentException("EXPLORER_GROUP_NOT_FOUND"));
        ConnectionEntity entity = connectionContext.requireConnection(
                connectionContext.requireUserId(),
                connectionId,
                ConnectionExecutionContext.EXPLORER_CONNECTION_NOT_FOUND
        ).entity();
        if (!group.getId().equals(entity.getGroupId())) {
            entity.setGroupId(group.getId());
            entity.setSortOrder(connectionVisibilityService.connectionsForGroup(group.getId()).size());
            persistConnection(entity);
        }
        return groupService.buildGroupTree();
    }

    public ImportConnectionsResult importConnections(List<ConnectionConfig> configs) {
        resourcePolicy.requireWrite(UserResource.CONNECTIONS_XML_BULK);
        connectionContext.requireUserId();
        String groupId = groupService.defaultGroupId();
        int count = 0;
        if (configs != null) {
            for (ConnectionConfig config : configs) {
                createConnection(config, groupId);
                count++;
            }
        }
        return new ImportConnectionsResult(count, groupService.buildGroupTree());
    }

    private void persistConnection(ConnectionEntity entity) {
        catalogPersistence.saveConnection(entity);
    }
}
