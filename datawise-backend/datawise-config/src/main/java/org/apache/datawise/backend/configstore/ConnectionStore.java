package org.apache.datawise.backend.configstore;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.configstore.connections.ConnectionCatalogCache;
import org.apache.datawise.backend.configstore.connections.ConnectionCatalogPersistence;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.model.ConnectionGroupEntity;
import org.apache.datawise.backend.security.SecretValueCodec;
import org.apache.datawise.backend.common.support.ConnectionsXmlCodec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * 连接与分组门面：{@code config/connections.xml}。
 * <p>
 * 仓库级共享：同一 {@code connections.xml} 对所有登录用户可见；{@code userId} 字段仅作元数据，不参与过滤。
 */
@Service
public class ConnectionStore {

    private final ConnectionCatalogPersistence persistence;

    @Autowired
    public ConnectionStore(
            ConfigDirectoryService configDirectory,
            ObjectMapper objectMapper,
            SecretValueCodec secretValueCodec
    ) {
        this(new ConnectionCatalogPersistence(
                configDirectory,
                objectMapper,
                secretValueCodec,
                new ConnectionCatalogCache()
        ));
    }

    ConnectionStore(ConnectionCatalogPersistence persistence) {
        this.persistence = persistence;
    }

    public Path connectionsFilePath() {
        return persistence.connectionsFilePath();
    }

    public String readConnectionsXml() throws Exception {
        return persistence.readConnectionsXml();
    }

    public List<ConnectionGroupEntity> findAllGroups() {
        return sortedGroups(persistence.loadDecryptedCatalog());
    }

    public List<ConnectionEntity> findAllConnections() {
        return sortedConnections(persistence.loadDecryptedCatalog());
    }

    public List<ConnectionGroupEntity> findRootGroups() {
        return persistence.loadDecryptedCatalog().groups().stream()
                .filter(group -> group.getParentId() == null)
                .sorted(Comparator.comparingInt(ConnectionGroupEntity::getSortOrder))
                .toList();
    }

    public List<ConnectionGroupEntity> findChildGroups(String parentId) {
        return persistence.loadDecryptedCatalog().groups().stream()
                .filter(group -> parentId.equals(group.getParentId()))
                .sorted(Comparator.comparingInt(ConnectionGroupEntity::getSortOrder))
                .toList();
    }

    public synchronized void replaceAll(List<ConnectionGroupEntity> groups, List<ConnectionEntity> connections) {
        persistence.replaceAll(groups, connections);
    }

    public synchronized void importConnectionsXml(String xml) throws IOException {
        persistence.importConnectionsXml(xml);
    }

    public Optional<ConnectionGroupEntity> findGroupById(String groupId) {
        return persistence.findGroupById(groupId);
    }

    public synchronized ConnectionGroupEntity saveGroup(ConnectionGroupEntity group) {
        return persistence.upsertGroup(group);
    }

    public synchronized void deleteGroupById(String groupId) {
        persistence.removeGroup(groupId);
    }

    public Optional<ConnectionEntity> findConnectionById(String connectionId) {
        return persistence.findConnectionById(connectionId);
    }

    public List<ConnectionEntity> findConnectionsByGroupId(String groupId) {
        return persistence.findConnectionsByGroupId(groupId);
    }

    public synchronized ConnectionEntity saveConnection(ConnectionEntity connection) {
        return persistence.upsertConnection(connection);
    }

    public synchronized void deleteConnectionById(String connectionId) {
        persistence.removeConnection(connectionId);
    }

    public synchronized int migratePlaintextSecretsIfNeeded() {
        return persistence.migratePlaintextSecretsIfNeeded();
    }

    private static List<ConnectionGroupEntity> sortedGroups(ConnectionsXmlCodec.ParsedCatalog catalog) {
        return catalog.groups().stream()
                .sorted(Comparator.comparingInt(ConnectionGroupEntity::getSortOrder))
                .toList();
    }

    private static List<ConnectionEntity> sortedConnections(ConnectionsXmlCodec.ParsedCatalog catalog) {
        return catalog.connections().stream()
                .sorted(Comparator.comparingInt(ConnectionEntity::getSortOrder))
                .toList();
    }
}
