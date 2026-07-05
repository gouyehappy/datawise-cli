package org.apache.datawise.backend.configstore.connections;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.configstore.ConfigDirectoryService;
import org.apache.datawise.backend.configstore.ConfigPaths;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.model.ConnectionGroupEntity;
import org.apache.datawise.backend.security.ConnectionSecrets;
import org.apache.datawise.backend.security.SecretValueCodec;
import org.apache.datawise.backend.common.support.ConnectionsXmlCodec;
import org.apache.datawise.backend.common.support.XmlConfigSupport;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

/**
 * connections.xml 读写、导入与密钥加解密。
 */
public final class ConnectionCatalogPersistence {

    private final ConfigDirectoryService configDirectory;
    private final ObjectMapper objectMapper;
    private final SecretValueCodec secretValueCodec;
    private final ConnectionCatalogCache cache;
    private final Object loadLock = new Object();

    public ConnectionCatalogPersistence(
            ConfigDirectoryService configDirectory,
            ObjectMapper objectMapper,
            SecretValueCodec secretValueCodec,
            ConnectionCatalogCache cache
    ) {
        this.configDirectory = configDirectory;
        this.objectMapper = objectMapper;
        this.secretValueCodec = secretValueCodec;
        this.cache = cache;
    }

    public Path connectionsFilePath() {
        return configDirectory.resolve(ConfigPaths.CONNECTIONS);
    }

    public String readConnectionsXml() throws IOException {
        Path path = connectionsFilePath();
        if (!ConnectionsXmlCodec.isRegularFile(path)) {
            return "";
        }
        return ConnectionsXmlCodec.readUtf8(path);
    }

    public ConnectionsXmlCodec.ParsedCatalog loadDecryptedCatalog() {
        return requireEntry().catalog();
    }

    public Optional<ConnectionEntity> findConnectionById(String connectionId) {
        if (connectionId == null || connectionId.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(requireEntry().connectionsById().get(connectionId));
    }

    public Optional<ConnectionGroupEntity> findGroupById(String groupId) {
        if (groupId == null || groupId.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(requireEntry().groupsById().get(groupId));
    }

    public List<ConnectionEntity> findConnectionsByGroupId(String groupId) {
        if (groupId == null || groupId.isBlank()) {
            return List.of();
        }
        return requireEntry().connectionsByGroupId().getOrDefault(groupId, List.of());
    }

    private ConnectionCatalogCache.Entry requireEntry() {
        try {
            Path xmlPath = connectionsFilePath();
            if (!ConnectionsXmlCodec.isRegularFile(xmlPath)) {
                cache.invalidate();
                return ConnectionCatalogCache.buildEntry(0L, emptyCatalog());
            }
            long lastModified = Files.getLastModifiedTime(xmlPath).toMillis();
            ConnectionCatalogCache.Entry cached = cache.getIfFresh(lastModified);
            if (cached != null) {
                return cached;
            }
            synchronized (loadLock) {
                ConnectionCatalogCache.Entry again = cache.getIfFresh(lastModified);
                if (again != null) {
                    return again;
                }
                ConnectionsXmlCodec.ParsedCatalog raw = ConnectionsXmlCodec.read(xmlPath, objectMapper);
                List<ConnectionEntity> connections = new ArrayList<>(raw.connections());
                ConnectionSecrets.decryptAll(connections, secretValueCodec);
                ConnectionsXmlCodec.ParsedCatalog catalog = new ConnectionsXmlCodec.ParsedCatalog(
                        new ArrayList<>(raw.groups()),
                        connections
                );
                return cache.putAndGet(lastModified, catalog);
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to read " + ConfigPaths.CONNECTIONS, ex);
        }
    }

    ConnectionsXmlCodec.ParsedCatalog loadRawCatalog() {
        try {
            Path xmlPath = connectionsFilePath();
            if (!ConnectionsXmlCodec.isRegularFile(xmlPath)) {
                return emptyCatalog();
            }
            return ConnectionsXmlCodec.read(xmlPath, objectMapper);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to read " + ConfigPaths.CONNECTIONS, ex);
        }
    }

    public synchronized void replaceAll(List<ConnectionGroupEntity> groups, List<ConnectionEntity> connections) {
        writeToDisk(
                groups != null ? new ArrayList<>(groups) : new ArrayList<>(),
                connections != null ? new ArrayList<>(connections) : new ArrayList<>()
        );
    }

    public synchronized void importConnectionsXml(String xml) throws IOException {
        if (xml == null || xml.isBlank()) {
            replaceAll(List.of(), List.of());
            return;
        }
        try {
            var factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            var document = factory.newDocumentBuilder()
                    .parse(new java.io.ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
            Path temp = configDirectory.resolve(".__connections-import.xml");
            XmlConfigSupport.writeDocument(temp, document);
            ConnectionsXmlCodec.ParsedCatalog parsed = ConnectionsXmlCodec.read(temp, objectMapper);
            Files.deleteIfExists(temp);
            writeToDisk(parsed.groups(), parsed.connections());
        } catch (IOException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IOException("Invalid connections.xml", ex);
        }
    }

    public synchronized int migratePlaintextSecretsIfNeeded() {
        ConnectionsXmlCodec.ParsedCatalog catalog = loadRawCatalog();
        int plaintextFields = ConnectionSecrets.countPlaintextFields(catalog.connections(), secretValueCodec);
        if (plaintextFields == 0) {
            return 0;
        }
        writeToDisk(catalog.groups(), catalog.connections());
        return plaintextFields;
    }

    synchronized void mutate(Consumer<MutableConnectionCatalog> mutation) {
        cache.invalidate();
        MutableConnectionCatalog catalog = MutableConnectionCatalog.from(loadDecryptedCatalog());
        mutation.accept(catalog);
        writeToDisk(catalog.groups(), catalog.connections());
    }

    public synchronized ConnectionGroupEntity upsertGroup(ConnectionGroupEntity group) {
        mutate(catalog -> {
            catalog.groups().removeIf(existing -> existing.getId().equals(group.getId()));
            catalog.groups().add(group);
        });
        return group;
    }

    public synchronized void removeGroup(String groupId) {
        mutate(catalog -> catalog.groups().removeIf(group -> groupId.equals(group.getId())));
    }

    public synchronized ConnectionEntity upsertConnection(ConnectionEntity connection) {
        mutate(catalog -> {
            catalog.connections().removeIf(existing -> existing.getId().equals(connection.getId()));
            catalog.connections().add(connection);
        });
        return connection;
    }

    public synchronized void removeConnection(String connectionId) {
        mutate(catalog ->
                catalog.connections().removeIf(connection -> connectionId.equals(connection.getId())));
    }

    private void writeToDisk(List<ConnectionGroupEntity> groups, List<ConnectionEntity> connections) {
        try {
            configDirectory.ensureExists();
            List<ConnectionEntity> toWrite = new ArrayList<>(connections);
            ConnectionSecrets.encryptAll(toWrite, secretValueCodec);
            ConnectionsXmlCodec.write(connectionsFilePath(), groups, toWrite, objectMapper);
            cache.invalidate();
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to persist " + ConfigPaths.CONNECTIONS, ex);
        }
    }

    private static ConnectionsXmlCodec.ParsedCatalog emptyCatalog() {
        return new ConnectionsXmlCodec.ParsedCatalog(List.of(), List.of());
    }
}
