package org.apache.datawise.backend.configstore.jdbc;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.common.support.ConnectionsXmlCodec;
import org.apache.datawise.backend.configstore.ConfigDirectoryService;
import org.apache.datawise.backend.configstore.ConnectionStore;
import org.apache.datawise.backend.configstore.TenantScopedConfigSupport;
import org.apache.datawise.backend.configstore.connections.ConnectionCatalogCache;
import org.apache.datawise.backend.configstore.connections.MutableConnectionCatalog;
import org.apache.datawise.backend.domain.TenantIds;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.model.ConnectionGroupEntity;
import org.apache.datawise.backend.security.ConnectionSecrets;
import org.apache.datawise.backend.security.SecretValueCodec;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Connection catalog backed by {@code dw_connection_snapshots} (XML payload per tenant).
 */
@Service
@ConditionalOnProperty(prefix = "datawise.storage", name = "backend", havingValue = "jdbc")
public class JdbcConnectionStore implements ConnectionStore {

    private static final String EMPTY_XML = """
            <?xml version="1.0" encoding="UTF-8"?>
            <datawise-connections version="1"/>
            """;

    private final JdbcTemplate jdbc;
    private final ConfigDirectoryService configDirectory;
    private final ObjectMapper objectMapper;
    private final SecretValueCodec secretValueCodec;
    private final ConcurrentHashMap<String, ConnectionCatalogCache> caches = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Object> loadLocks = new ConcurrentHashMap<>();

    public JdbcConnectionStore(
            @Qualifier(MetadataJdbcConfiguration.METADATA_JDBC) JdbcTemplate jdbc,
            ConfigDirectoryService configDirectory,
            ObjectMapper objectMapper,
            SecretValueCodec secretValueCodec
    ) {
        this.jdbc = jdbc;
        this.configDirectory = configDirectory;
        this.objectMapper = objectMapper;
        this.secretValueCodec = secretValueCodec;
        ensureTenantFiles(TenantIds.DEFAULT);
    }

    @Override
    public void ensureTenantFiles(String tenantId) {
        String id = TenantIds.normalizeOrDefault(tenantId);
        if (!snapshotExists(id)) {
            writePayload(id, EMPTY_XML);
        }
    }

    @Override
    public Path connectionsFilePath() {
        // Logical export path (data lives in JDBC); kept for API compatibility.
        return configDirectory.resolve(
                TenantScopedConfigSupport.connectionsPath(TenantScopedConfigSupport.currentTenantId())
        );
    }

    @Override
    public String readConnectionsXml() {
        return loadPayload(currentTenantId());
    }

    @Override
    public List<ConnectionGroupEntity> findAllGroups() {
        return sortedGroups(requireEntry().catalog());
    }

    @Override
    public List<ConnectionEntity> findAllConnections() {
        return sortedConnections(requireEntry().catalog());
    }

    @Override
    public List<ConnectionGroupEntity> findRootGroups() {
        return requireEntry().catalog().groups().stream()
                .filter(group -> group.getParentId() == null)
                .sorted(Comparator.comparingInt(ConnectionGroupEntity::getSortOrder))
                .toList();
    }

    @Override
    public List<ConnectionGroupEntity> findChildGroups(String parentId) {
        return requireEntry().catalog().groups().stream()
                .filter(group -> parentId.equals(group.getParentId()))
                .sorted(Comparator.comparingInt(ConnectionGroupEntity::getSortOrder))
                .toList();
    }

    @Override
    public synchronized void replaceAll(List<ConnectionGroupEntity> groups, List<ConnectionEntity> connections) {
        writeCatalog(
                groups != null ? new ArrayList<>(groups) : new ArrayList<>(),
                connections != null ? new ArrayList<>(connections) : new ArrayList<>()
        );
    }

    @Override
    public synchronized void importConnectionsXml(String xml) throws IOException {
        if (xml == null || xml.isBlank()) {
            replaceAll(List.of(), List.of());
            return;
        }
        try {
            ConnectionsXmlCodec.ParsedCatalog parsed = parseXml(xml);
            writeCatalog(parsed.groups(), parsed.connections());
        } catch (IllegalStateException ex) {
            throw new IOException("Invalid connections.xml", ex);
        }
    }

    @Override
    public Optional<ConnectionGroupEntity> findGroupById(String groupId) {
        if (groupId == null || groupId.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(requireEntry().groupsById().get(groupId));
    }

    @Override
    public synchronized ConnectionGroupEntity saveGroup(ConnectionGroupEntity group) {
        mutate(catalog -> {
            catalog.groups().removeIf(existing -> existing.getId().equals(group.getId()));
            catalog.groups().add(group);
        });
        return group;
    }

    @Override
    public synchronized void deleteGroupById(String groupId) {
        mutate(catalog -> catalog.groups().removeIf(group -> groupId.equals(group.getId())));
    }

    @Override
    public Optional<ConnectionEntity> findConnectionById(String connectionId) {
        if (connectionId == null || connectionId.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(requireEntry().connectionsById().get(connectionId));
    }

    @Override
    public List<ConnectionEntity> findConnectionsByGroupId(String groupId) {
        if (groupId == null || groupId.isBlank()) {
            return List.of();
        }
        return requireEntry().connectionsByGroupId().getOrDefault(groupId, List.of());
    }

    @Override
    public synchronized ConnectionEntity saveConnection(ConnectionEntity connection) {
        mutate(catalog -> {
            catalog.connections().removeIf(existing -> existing.getId().equals(connection.getId()));
            catalog.connections().add(connection);
        });
        return connection;
    }

    @Override
    public synchronized void deleteConnectionById(String connectionId) {
        mutate(catalog ->
                catalog.connections().removeIf(connection -> connectionId.equals(connection.getId())));
    }

    @Override
    public synchronized int migratePlaintextSecretsIfNeeded() {
        ConnectionsXmlCodec.ParsedCatalog catalog = parseXml(loadPayload(currentTenantId()));
        int plaintextFields = ConnectionSecrets.countPlaintextFields(catalog.connections(), secretValueCodec);
        if (plaintextFields == 0) {
            return 0;
        }
        writeCatalog(catalog.groups(), catalog.connections());
        return plaintextFields;
    }

    /** Used by file→jdbc import. */
    public synchronized void replaceXmlPayload(String tenantId, String xml) {
        String id = TenantIds.normalizeOrDefault(tenantId);
        writePayload(id, xml != null && !xml.isBlank() ? xml : EMPTY_XML);
        caches.computeIfAbsent(id, ignored -> new ConnectionCatalogCache()).invalidate();
    }

    private void mutate(Consumer<MutableConnectionCatalog> mutation) {
        cacheForCurrent().invalidate();
        MutableConnectionCatalog catalog = MutableConnectionCatalog.from(requireEntry().catalog());
        mutation.accept(catalog);
        writeCatalog(catalog.groups(), catalog.connections());
    }

    private ConnectionCatalogCache.Entry requireEntry() {
        String tenantId = currentTenantId();
        ConnectionCatalogCache cache = cacheForCurrent();
        String payload = loadPayload(tenantId);
        long version = payload.hashCode();
        ConnectionCatalogCache.Entry cached = cache.getIfFresh(version);
        if (cached != null) {
            return cached;
        }
        synchronized (loadLockFor(tenantId)) {
            ConnectionCatalogCache.Entry again = cache.getIfFresh(version);
            if (again != null) {
                return again;
            }
            ConnectionsXmlCodec.ParsedCatalog raw = parseXml(payload);
            List<ConnectionEntity> connections = new ArrayList<>(raw.connections());
            ConnectionSecrets.decryptAll(connections, secretValueCodec);
            ConnectionsXmlCodec.ParsedCatalog catalog = new ConnectionsXmlCodec.ParsedCatalog(
                    new ArrayList<>(raw.groups()),
                    connections
            );
            return cache.putAndGet(version, catalog);
        }
    }

    private void writeCatalog(List<ConnectionGroupEntity> groups, List<ConnectionEntity> connections) {
        try {
            List<ConnectionEntity> toWrite = new ArrayList<>(connections);
            ConnectionSecrets.encryptAll(toWrite, secretValueCodec);
            Path temp = Files.createTempFile("dw-conn-", ".xml");
            try {
                ConnectionsXmlCodec.write(temp, groups, toWrite, objectMapper);
                String xml = Files.readString(temp, StandardCharsets.UTF_8);
                writePayload(currentTenantId(), xml);
            } finally {
                Files.deleteIfExists(temp);
            }
            cacheForCurrent().invalidate();
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to persist connection catalog", ex);
        }
    }

    private ConnectionsXmlCodec.ParsedCatalog parseXml(String xml) {
        if (xml == null || xml.isBlank()) {
            return new ConnectionsXmlCodec.ParsedCatalog(List.of(), List.of());
        }
        try {
            Path temp = Files.createTempFile("dw-conn-read-", ".xml");
            try {
                Files.writeString(temp, xml, StandardCharsets.UTF_8);
                return ConnectionsXmlCodec.read(temp, objectMapper);
            } finally {
                Files.deleteIfExists(temp);
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to parse connection catalog", ex);
        }
    }

    private String loadPayload(String tenantId) {
        List<String> rows = jdbc.query(
                "SELECT payload FROM dw_connection_snapshots WHERE tenant_id = ?",
                (rs, rowNum) -> rs.getString("payload"),
                tenantId
        );
        if (rows.isEmpty() || rows.get(0) == null || rows.get(0).isBlank()) {
            return EMPTY_XML;
        }
        return rows.get(0);
    }

    private void writePayload(String tenantId, String xml) {
        Timestamp now = Timestamp.from(Instant.now());
        int updated = jdbc.update(
                "UPDATE dw_connection_snapshots SET payload = ?, updated_at = ? WHERE tenant_id = ?",
                xml,
                now,
                tenantId
        );
        if (updated == 0) {
            jdbc.update(
                    "INSERT INTO dw_connection_snapshots (tenant_id, payload, updated_at) VALUES (?,?,?)",
                    tenantId,
                    xml,
                    now
            );
        }
    }

    private boolean snapshotExists(String tenantId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dw_connection_snapshots WHERE tenant_id = ?",
                Integer.class,
                tenantId
        );
        return count != null && count > 0;
    }

    private String currentTenantId() {
        return TenantScopedConfigSupport.currentTenantId();
    }

    private ConnectionCatalogCache cacheForCurrent() {
        return caches.computeIfAbsent(currentTenantId(), ignored -> new ConnectionCatalogCache());
    }

    private Object loadLockFor(String tenantId) {
        return loadLocks.computeIfAbsent(tenantId, ignored -> new Object());
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
