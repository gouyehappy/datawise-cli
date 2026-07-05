package org.apache.datawise.backend.common.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.model.ConnectionGroupEntity;
import org.apache.datawise.backend.common.support.ConnectionEnvironmentSupport;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class ConnectionsXmlCodec {

    private ConnectionsXmlCodec() {
    }

    public record ParsedCatalog(List<ConnectionGroupEntity> groups, List<ConnectionEntity> connections) {
    }

    public static boolean isRegularFile(Path path) {
        return Files.isRegularFile(path);
    }

    public static String readUtf8(Path path) throws IOException {
        return Files.readString(path, StandardCharsets.UTF_8);
    }

    public static ParsedCatalog read(Path path, ObjectMapper objectMapper) throws IOException {
        try {
            Document document = XmlConfigSupport.readDocument(path);
            Element root = XmlConfigSupport.rootElement(document);
            List<ConnectionGroupEntity> groups = new ArrayList<>();
            List<ConnectionEntity> connections = new ArrayList<>();

            NodeList groupNodes = root.getElementsByTagName("group");
            for (int i = 0; i < groupNodes.getLength(); i++) {
                Element groupElement = (Element) groupNodes.item(i);
                ConnectionGroupEntity group = parseGroup(groupElement);
                groups.add(group);
                NodeList connectionNodes = groupElement.getElementsByTagName("connection");
                for (int j = 0; j < connectionNodes.getLength(); j++) {
                    Element connectionElement = (Element) connectionNodes.item(j);
                    if (!connectionElement.getParentNode().equals(groupElement)) {
                        continue;
                    }
                    connections.add(parseConnection(connectionElement, group.getId(), objectMapper));
                }
            }
            return new ParsedCatalog(groups, connections);
        } catch (Exception ex) {
            throw new IOException("Failed to parse connections.xml", ex);
        }
    }

    public static void write(
            Path path,
            List<ConnectionGroupEntity> groups,
            List<ConnectionEntity> connections,
            ObjectMapper objectMapper
    ) throws IOException {
        try {
            Document document = XmlConfigSupport.newDocument();
            Element root = document.createElement("datawise-connections");
            root.setAttribute("version", "1");
            document.appendChild(root);

            for (ConnectionGroupEntity group : groups.stream()
                    .filter(group -> group.getParentId() == null || group.getParentId().isBlank())
                    .toList()) {
                appendGroupTree(document, root, group, groups, connections, objectMapper);
            }

            XmlConfigSupport.writeDocument(path, document);
        } catch (Exception ex) {
            throw new IOException("Failed to write connections.xml", ex);
        }
    }

    private static void appendGroupTree(
            Document document,
            Element parent,
            ConnectionGroupEntity group,
            List<ConnectionGroupEntity> allGroups,
            List<ConnectionEntity> allConnections,
            ObjectMapper objectMapper
    ) throws Exception {
        Element groupElement = document.createElement("group");
        groupElement.setAttribute("id", group.getId());
        groupElement.setAttribute("label", group.getLabel());
        groupElement.setAttribute("sort-order", String.valueOf(group.getSortOrder()));
        groupElement.setAttribute("expanded", String.valueOf(group.isExpanded()));
        if (group.getUserId() != null) {
            groupElement.setAttribute("user-id", String.valueOf(group.getUserId()));
        }
        parent.appendChild(groupElement);

        for (ConnectionEntity connection : allConnections.stream()
                .filter(item -> group.getId().equals(item.getGroupId()))
                .toList()) {
            groupElement.appendChild(buildConnectionElement(document, connection, objectMapper));
        }

        for (ConnectionGroupEntity child : allGroups.stream()
                .filter(item -> group.getId().equals(item.getParentId()))
                .toList()) {
            appendGroupTree(document, groupElement, child, allGroups, allConnections, objectMapper);
        }
    }

    private static Element buildConnectionElement(
            Document document,
            ConnectionEntity connection,
            ObjectMapper objectMapper
    ) throws Exception {
        ConnectionEnvironmentSupport.applyToEntity(connection);
        Element connectionElement = document.createElement("connection");
        connectionElement.setAttribute("id", connection.getId());
        connectionElement.setAttribute("name", nullToEmpty(connection.getName()));
        connectionElement.setAttribute("db-type", nullToEmpty(connection.getDbType()));
        connectionElement.setAttribute("sort-order", String.valueOf(connection.getSortOrder()));
        if (connection.getUserId() != null) {
            connectionElement.setAttribute("user-id", String.valueOf(connection.getUserId()));
        }

        appendTextChild(document, connectionElement, "env", connection.getEnv());
        appendTextChild(document, connectionElement, "env-custom", connection.getEnvCustom());
        appendTextChild(document, connectionElement, "storage", connection.getStorage());
        appendTextChild(document, connectionElement, "host", connection.getHost());
        appendTextChild(document, connectionElement, "port", connection.getPort());
        appendTextChild(document, connectionElement, "auth-type", connection.getAuthType());
        appendTextChild(document, connectionElement, "username", connection.getUsername());
        appendTextChild(document, connectionElement, "password", connection.getPassword());
        appendTextChild(document, connectionElement, "jdbc-url", connection.getJdbcUrl());
        appendTextChild(document, connectionElement, "database", connection.getDatabaseName());
        appendTextChild(document, connectionElement, "sid", connection.getSid());
        appendTextChild(document, connectionElement, "service-type", connection.getServiceType());
        appendTextChild(document, connectionElement, "driver", connection.getDriver());
        appendTextChild(document, connectionElement, "driver-class", connection.getDriverClass());
        appendTextChild(document, connectionElement, "ssh-host", connection.getSshHost());
        appendTextChild(document, connectionElement, "ssh-port", connection.getSshPort());
        appendTextChild(document, connectionElement, "ssh-user", connection.getSshUser());
        appendTextChild(document, connectionElement, "ssh-password", connection.getSshPassword());
        if (connection.getSshPrivateKey() != null && !connection.getSshPrivateKey().isBlank()) {
            XmlConfigSupport.appendCdataElement(
                    document,
                    connectionElement,
                    "ssh-private-key",
                    connection.getSshPrivateKey()
            );
        }
        appendTextChild(document, connectionElement, "ssh-passphrase", connection.getSshPassphrase());

        Element sshEnabled = document.createElement("ssh-enabled");
        sshEnabled.setTextContent(String.valueOf(connection.isSshEnabled()));
        connectionElement.appendChild(sshEnabled);

        if (connection.getAdvancedConfig() != null && !connection.getAdvancedConfig().isBlank()) {
            XmlConfigSupport.appendCdataElement(document, connectionElement, "advanced-config", connection.getAdvancedConfig());
        }
        return connectionElement;
    }

    private static ConnectionGroupEntity parseGroup(Element element) {
        ConnectionGroupEntity group = new ConnectionGroupEntity();
        group.setId(element.getAttribute("id"));
        group.setLabel(element.getAttribute("label"));
        group.setSortOrder(parseInt(element.getAttribute("sort-order"), 0));
        group.setExpanded(parseBoolean(element.getAttribute("expanded"), true));
        String userId = element.getAttribute("user-id");
        if (!userId.isBlank()) {
            group.setUserId(Long.parseLong(userId));
        }
        return group;
    }

    private static ConnectionEntity parseConnection(
            Element element,
            String groupId,
            ObjectMapper objectMapper
    ) {
        ConnectionEntity connection = new ConnectionEntity();
        connection.setId(element.getAttribute("id"));
        connection.setGroupId(groupId);
        connection.setName(element.getAttribute("name"));
        connection.setDbType(element.getAttribute("db-type"));
        connection.setSortOrder(parseInt(element.getAttribute("sort-order"), 0));
        String userId = element.getAttribute("user-id");
        if (!userId.isBlank()) {
            connection.setUserId(Long.parseLong(userId));
        }

        connection.setEnv(childText(element, "env"));
        connection.setEnvCustom(childText(element, "env-custom"));
        connection.setStorage(childText(element, "storage"));
        connection.setHost(childText(element, "host"));
        connection.setPort(childText(element, "port"));
        connection.setAuthType(childText(element, "auth-type"));
        connection.setUsername(childText(element, "username"));
        connection.setPassword(childText(element, "password"));
        connection.setJdbcUrl(childText(element, "jdbc-url"));
        connection.setDatabaseName(childText(element, "database"));
        connection.setSid(childText(element, "sid"));
        connection.setServiceType(childText(element, "service-type"));
        connection.setDriver(childText(element, "driver"));
        connection.setDriverClass(childText(element, "driver-class"));
        connection.setSshHost(childText(element, "ssh-host"));
        connection.setSshPort(childText(element, "ssh-port"));
        connection.setSshUser(childText(element, "ssh-user"));
        connection.setSshPassword(childText(element, "ssh-password"));
        connection.setSshPrivateKey(childText(element, "ssh-private-key"));
        connection.setSshPassphrase(childText(element, "ssh-passphrase"));
        connection.setSshEnabled(parseBoolean(childText(element, "ssh-enabled"), false));
        connection.setAdvancedConfig(childText(element, "advanced-config"));
        ConnectionEnvironmentSupport.applyToEntity(connection);
        return connection;
    }

    private static void appendTextChild(Document document, Element parent, String tag, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        XmlConfigSupport.appendTextElement(document, parent, tag, value);
    }

    private static String childText(Element parent, String tag) {
        return XmlConfigSupport.childText(parent, tag);
    }

    private static int parseInt(String value, int fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private static boolean parseBoolean(String value, boolean fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return Boolean.parseBoolean(value.trim());
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
