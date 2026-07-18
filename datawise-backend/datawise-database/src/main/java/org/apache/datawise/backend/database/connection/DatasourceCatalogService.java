package org.apache.datawise.backend.database.connection;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.common.DbTypeCatalogEntry;
import org.apache.datawise.backend.connector.ConnectorCapability;
import org.apache.datawise.backend.connector.DataSourceConnector;
import org.apache.datawise.backend.connector.facade.ConnectorFacade;
import org.apache.datawise.backend.connector.plugin.ConnectorPluginManifestSupport;
import org.apache.datawise.backend.connector.support.ConnectorCapabilityCatalog;
import org.apache.datawise.backend.connector.plugin.ConnectorPluginRemoteInstallSupport;
import org.apache.datawise.backend.domain.ConnectorMarketEntryDto;
import org.apache.datawise.backend.domain.ConnectorPluginIntegrityStatus;
import org.apache.datawise.backend.domain.ConnectorPluginLoadFailure;
import org.apache.datawise.backend.domain.ConnectorPluginManifest;
import org.apache.datawise.backend.domain.ConnectorPluginManifestEntry;
import org.apache.datawise.backend.domain.DatasourceDefinitionDto;
import org.apache.datawise.backend.domain.InstallConnectorPluginResultDto;
import org.apache.datawise.backend.ops.DatabaseOpsRegistry;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class DatasourceCatalogService {

    private final ConnectorFacade connectorFacade;
    private final DatabaseOpsRegistry opsRegistry;
    private volatile CatalogSnapshot snapshot;

    public DatasourceCatalogService(ConnectorFacade connectorFacade, DatabaseOpsRegistry opsRegistry) {
        this.connectorFacade = connectorFacade;
        this.opsRegistry = opsRegistry;
    }

    /** Lists catalog-visible datasource types that have a loaded connector plugin. */
    public List<DatasourceDefinitionDto> listAvailable() {
        return snapshot().available();
    }

    /** Full connector market: every catalog-listed type with runtime availability. */
    public List<ConnectorMarketEntryDto> listMarket() {
        CatalogSnapshot snap = snapshot();
        Optional<ConnectorPluginManifest> manifest = connectorFacade.catalog().pluginManifest();
        Map<String, String> jarByConnector = connectorFacade.catalog().loadedJarByConnectorId();
        List<ConnectorMarketEntryDto> market = new ArrayList<>();
        for (DbType type : DbType.catalogListed()) {
            DbTypeCatalogEntry catalog = type.catalogEntry().orElseThrow();
            DatasourceDefinitionDto available = snap.byId().get(type.id());
            Optional<ConnectorPluginManifestEntry> manifestEntry = manifest.flatMap(
                    value -> ConnectorPluginManifestSupport.findById(value, type.id())
            );
            String loadedJar = jarByConnector.get(type.id());
            boolean fromPluginJar = loadedJar != null;
            if (available != null) {
                String integrity = ConnectorPluginManifestSupport.resolveIntegrityStatus(
                        true,
                        fromPluginJar,
                        manifestEntry,
                        connectorFacade.catalog().pluginsDirectory(),
                        loadedJar
                );
                market.add(new ConnectorMarketEntryDto(
                        available.id(),
                        available.label(),
                        available.primary(),
                        true,
                        available.capabilities(),
                        null,
                        manifestEntry.map(ConnectorPluginManifestEntry::version).orElse(null),
                        loadedJar != null ? loadedJar : manifestEntry.map(ConnectorPluginManifestEntry::jar).orElse(null),
                        integrity,
                        manifestEntry.map(ConnectorPluginManifestEntry::downloadUrl).orElse(null)
                ));
                continue;
            }
            String integrity = ConnectorPluginManifestSupport.resolveIntegrityStatus(
                    false,
                    false,
                    manifestEntry,
                    connectorFacade.catalog().pluginsDirectory(),
                    null
            );
            String hint = manifestEntry
                    .map(entry -> buildInstallHint(entry))
                    .orElse("Install connector plugin JAR under config/plugins and restart the backend.");
            market.add(new ConnectorMarketEntryDto(
                    type.id(),
                    type.getDisplayName(),
                    catalog.primary(),
                    false,
                    List.of(),
                    hint,
                    manifestEntry.map(ConnectorPluginManifestEntry::version).orElse(null),
                    manifestEntry.map(ConnectorPluginManifestEntry::jar).orElse(null),
                    integrity,
                    manifestEntry.map(ConnectorPluginManifestEntry::downloadUrl).orElse(null)
            ));
        }
        return List.copyOf(market);
    }

    public Optional<ConnectorPluginManifest> pluginManifest() {
        return connectorFacade.catalog().reloadPluginManifest();
    }

    /**
     * Downloads a marketplace connector JAR from its manifest {@code downloadUrl} into {@code config/plugins}.
     * The backend must be restarted (or plugins reloaded) before the connector becomes available.
     */
    public InstallConnectorPluginResultDto installRemotePlugin(String connectorId) {
        if (connectorId == null || connectorId.isBlank()) {
            throw new IllegalArgumentException("connectorId is required");
        }
        ConnectorPluginManifest manifest = connectorFacade.catalog().pluginManifest()
                .or(() -> connectorFacade.catalog().reloadPluginManifest())
                .orElseThrow(() -> new IllegalArgumentException(
                        "No config/plugins/manifest.json — add a manifest with downloadUrl before remote install"
                ));
        ConnectorPluginManifestEntry entry = ConnectorPluginManifestSupport.findById(manifest, connectorId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Connector not listed in manifest.json: " + connectorId
                ));
        if (entry.downloadUrl() == null || entry.downloadUrl().isBlank()) {
            throw new IllegalArgumentException(
                    "Manifest entry for " + connectorId + " has no downloadUrl"
            );
        }
        Path pluginsDir = connectorFacade.catalog().pluginsDirectory();
        try {
            Path installed = ConnectorPluginRemoteInstallSupport.install(
                    entry.downloadUrl(),
                    pluginsDir,
                    entry.jar(),
                    entry.sha256()
            );
            connectorFacade.catalog().reloadPluginManifest();
            String integrity = entry.sha256() != null && !entry.sha256().isBlank()
                    ? ConnectorPluginIntegrityStatus.VERIFIED
                    : ConnectorPluginIntegrityStatus.UNSIGNED;
            return new InstallConnectorPluginResultDto(
                    entry.id(),
                    installed.getFileName().toString(),
                    integrity,
                    true,
                    "Plugin JAR installed under config/plugins. Restart the backend to load the connector."
            );
        } catch (IOException ex) {
            throw new IllegalStateException(
                    "Failed to download connector plugin " + connectorId + ": " + ex.getMessage(),
                    ex
            );
        }
    }

    public Optional<DatasourceDefinitionDto> findById(String id) {
        if (id == null || id.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(snapshot().byId().get(catalogId(id)));
    }

    /**
     * 校验当前运行时是否已加载对应数据源插件；未加载则拒绝创建连接或执行操作。
     */
    public void requireAvailable(String dbType) {
        if (dbType == null || dbType.isBlank()) {
            throw new IllegalArgumentException("DATASOURCE_TYPE_REQUIRED");
        }
        String normalized = catalogId(dbType);
        if (!snapshot().byId().containsKey(normalized)) {
            throw new IllegalArgumentException("DATASOURCE_NOT_AVAILABLE: " + normalized);
        }
    }

    /** Optional connector plugin JARs successfully loaded from {@code config/plugins}. */
    public List<String> loadedPluginJarNames() {
        return connectorFacade.catalog().loadedPluginJarNames();
    }

    /** Plugin JARs that failed to load; useful when a datasource type is missing at runtime. */
    public List<ConnectorPluginLoadFailure> pluginLoadFailures() {
        return connectorFacade.catalog().failedPluginLoads();
    }

    private CatalogSnapshot snapshot() {
        CatalogSnapshot current = snapshot;
        if (current != null) {
            return current;
        }
        synchronized (this) {
            if (snapshot == null) {
                snapshot = buildSnapshot();
            }
            return snapshot;
        }
    }

    private CatalogSnapshot buildSnapshot() {
        List<DatasourceDefinitionDto> available = new ArrayList<>();
        Map<String, DatasourceDefinitionDto> byId = new LinkedHashMap<>();
        for (DbType type : DbType.catalogListed()) {
            if (!isImplemented(type.id())) {
                continue;
            }
            DataSourceConnector connector = connectorFacade.catalog().resolve(type.id());
            DbTypeCatalogEntry catalog = type.catalogEntry().orElseThrow();
            DatasourceDefinitionDto definition = new DatasourceDefinitionDto(
                    type.id(),
                    type.getDisplayName(),
                    catalog.primary(),
                    String.valueOf(type.getPort()),
                    catalog.jdbcDriverRequired(),
                    catalog.driverMaven(),
                    catalog.jdbcDriverRequired() ? catalog.resolveDriverClass(type) : null,
                    capabilityNames(ConnectorCapabilityCatalog.resolve(connector, type.id(), opsRegistry)),
                    type.getQuote()
            );
            available.add(definition);
            byId.put(type.id(), definition);
        }
        return new CatalogSnapshot(List.copyOf(available), Map.copyOf(byId));
    }

    private boolean isImplemented(String dbType) {
        try {
            return connectorFacade.catalog().supports(dbType);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private static List<String> capabilityNames(EnumSet<ConnectorCapability> capabilities) {
        return capabilities.stream().map(Enum::name).sorted().toList();
    }

    private static String catalogId(String dbType) {
        return DbType.find(dbType).map(DbType::id).orElse(DbType.normalizeId(dbType));
    }

    private static String buildInstallHint(ConnectorPluginManifestEntry entry) {
        StringBuilder hint = new StringBuilder("Install connector plugin JAR under config/plugins");
        if (entry.jar() != null && !entry.jar().isBlank()) {
            hint.append(" as ").append(entry.jar());
        }
        hint.append(" and restart the backend.");
        if (entry.version() != null && !entry.version().isBlank()) {
            hint.append(" Manifest version: ").append(entry.version()).append('.');
        }
        if (entry.downloadUrl() != null && !entry.downloadUrl().isBlank()) {
            hint.append(" Download: ").append(entry.downloadUrl());
        }
        return hint.toString();
    }

    private record CatalogSnapshot(List<DatasourceDefinitionDto> available, Map<String, DatasourceDefinitionDto> byId) {
    }
}
