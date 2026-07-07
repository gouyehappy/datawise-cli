package org.apache.datawise.backend.configstore;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.configstore.app.AppConfigSections;
import org.apache.datawise.backend.security.AppConfigSecrets;
import org.apache.datawise.backend.security.SecretValueCodec;
import org.apache.datawise.backend.common.support.XmlConfigSupport;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;

import java.nio.file.Path;
import java.util.Map;
import java.util.Optional;

/**
 * 按注册用户隔离的 app.xml（{@code config/users/{userId}/app.xml}）。
 */
@Service
public class UserAppConfigStore {

    private static final Logger log = LoggerFactory.getLogger(UserAppConfigStore.class);

    private final ConfigDirectoryService configDirectory;
    private final AppConfigStore appConfigStore;
    private final ObjectMapper objectMapper;
    private final SecretValueCodec secretValueCodec;

    public UserAppConfigStore(
            ConfigDirectoryService configDirectory,
            AppConfigStore appConfigStore,
            ObjectMapper objectMapper,
            SecretValueCodec secretValueCodec
    ) {
        this.configDirectory = configDirectory;
        this.appConfigStore = appConfigStore;
        this.objectMapper = objectMapper;
        this.secretValueCodec = secretValueCodec;
    }

    public Optional<Map<String, Object>> readAppConfig(long userId) {
        Path path = userConfigPath(userId);
        if (!XmlConfigSupport.isRegularFile(path)) {
            return migrateFromGlobalIfNeeded(userId);
        }
        Optional<Map<String, Object>> parsed = parseAppConfig(path);
        if (parsed.isPresent()) {
            return parsed;
        }
        quarantineCorruptConfig(path, userId);
        return migrateFromGlobalIfNeeded(userId);
    }

    public void writeAppConfig(long userId, Map<String, Object> config) throws Exception {
        configDirectory.ensureExists();
        Path path = userConfigPath(userId);
        Path parent = path.getParent();
        if (parent != null) {
            java.nio.file.Files.createDirectories(parent);
        }
        Map<String, Object> toWrite = AppConfigSections.deepCopy(config);
        AppConfigSecrets.encryptAiSection(toWrite, secretValueCodec);
        Document document = XmlConfigSupport.newDocument();
        AppConfigSections.writeToDocument(objectMapper, document, toWrite);
        XmlConfigSupport.writeDocument(path, document);
    }

    public String readAppConfigXml(long userId) throws Exception {
        Path path = userConfigPath(userId);
        if (!XmlConfigSupport.isRegularFile(path)) {
            Optional<Map<String, Object>> migrated = migrateFromGlobalIfNeeded(userId);
            if (migrated.isEmpty()) {
                return null;
            }
            Document document = XmlConfigSupport.newDocument();
            AppConfigSections.writeToDocument(objectMapper, document, migrated.get());
            return XmlConfigSupport.documentToString(document);
        }
        if (!XmlConfigSupport.hasUsableXmlContent(path)) {
            quarantineCorruptConfig(path, userId);
            Optional<Map<String, Object>> migrated = migrateFromGlobalIfNeeded(userId);
            if (migrated.isEmpty()) {
                return null;
            }
            Document document = XmlConfigSupport.newDocument();
            AppConfigSections.writeToDocument(objectMapper, document, migrated.get());
            return XmlConfigSupport.documentToString(document);
        }
        try {
            return XmlConfigSupport.readUtf8(path);
        } catch (Exception ex) {
            quarantineCorruptConfig(path, userId);
            Optional<Map<String, Object>> migrated = migrateFromGlobalIfNeeded(userId);
            if (migrated.isEmpty()) {
                return null;
            }
            Document document = XmlConfigSupport.newDocument();
            AppConfigSections.writeToDocument(objectMapper, document, migrated.get());
            return XmlConfigSupport.documentToString(document);
        }
    }

    public void writeAppConfigXml(long userId, String xml) throws Exception {
        if (xml == null || xml.isBlank()) {
            return;
        }
        var factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        Document document;
        try {
            document = factory.newDocumentBuilder()
                    .parse(new java.io.ByteArrayInputStream(xml.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid XML", ex);
        }
        Map<String, Object> config = AppConfigSections.mapFromDocument(objectMapper, document);
        AppConfigSecrets.decryptAiSection(config, secretValueCodec);
        writeAppConfig(userId, config);
    }

    public Optional<Map<String, Object>> readPersonalSqlSnippets(long userId) {
        Path path = configDirectory.resolve(ConfigPaths.userSqlSnippetsPersonal(userId));
        if (!XmlConfigSupport.isRegularFile(path)) {
            return appConfigStore.readSqlSnippets("personal");
        }
        Optional<Map<String, Object>> parsed = readSnippetPayload(path);
        if (parsed.isPresent()) {
            return parsed;
        }
        quarantineCorruptConfig(path, userId);
        return appConfigStore.readSqlSnippets("personal");
    }

    public void writePersonalSqlSnippets(long userId, Map<String, Object> payload) throws Exception {
        configDirectory.ensureExists();
        Path path = configDirectory.resolve(ConfigPaths.userSqlSnippetsPersonal(userId));
        Path parent = path.getParent();
        if (parent != null) {
            java.nio.file.Files.createDirectories(parent);
        }
        Document document = XmlConfigSupport.newDocument();
        var root = document.createElement("datawise-sql-snippets");
        root.setAttribute("layer", "personal");
        document.appendChild(root);
        XmlConfigSupport.appendCdataElement(document, root, "payload", objectMapper.writeValueAsString(payload));
        XmlConfigSupport.writeDocument(path, document);
    }

    private Optional<Map<String, Object>> migrateFromGlobalIfNeeded(long userId) {
        Optional<Map<String, Object>> global = appConfigStore.readAppConfig();
        if (global.isEmpty()) {
            return Optional.empty();
        }
        try {
            writeAppConfig(userId, global.get());
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to migrate global app config for user " + userId, ex);
        }
        return global;
    }

    private Optional<Map<String, Object>> parseAppConfig(Path path) {
        if (!XmlConfigSupport.hasUsableXmlContent(path)) {
            return Optional.empty();
        }
        try {
            Document document = XmlConfigSupport.readDocument(path);
            Map<String, Object> config = AppConfigSections.mapFromDocument(objectMapper, document);
            AppConfigSecrets.decryptAiSection(config, secretValueCodec);
            return Optional.of(config);
        } catch (Exception ex) {
            ExceptionLogging.warn(log, "config.userApp.parse path=" + path, ex);
            return Optional.empty();
        }
    }

    private Optional<Map<String, Object>> readSnippetPayload(Path path) {
        if (!XmlConfigSupport.hasUsableXmlContent(path)) {
            return Optional.empty();
        }
        try {
            Document document = XmlConfigSupport.readDocument(path);
            var root = XmlConfigSupport.rootElement(document);
            String json = XmlConfigSupport.childText(root, "payload");
            if (json == null || json.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<>() {
            }));
        } catch (Exception ex) {
            ExceptionLogging.warn(log, "config.userSqlSnippets.parse path=" + path, ex);
            return Optional.empty();
        }
    }

    private void quarantineCorruptConfig(Path path, long userId) {
        try {
            Path backup = XmlConfigSupport.quarantineCorruptFile(path);
            if (backup != null) {
                log.warn("Quarantined corrupt user config for user {}: {} -> {}", userId, path, backup);
            }
        } catch (Exception ex) {
            ExceptionLogging.warn(log, "config.userApp.quarantine userId=" + userId + " path=" + path, ex);
        }
    }

    private Path userConfigPath(long userId) {
        return configDirectory.resolve(ConfigPaths.userAppConfig(userId));
    }
}
