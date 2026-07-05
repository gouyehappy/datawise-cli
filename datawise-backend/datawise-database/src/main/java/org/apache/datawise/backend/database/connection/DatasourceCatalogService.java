package org.apache.datawise.backend.database.connection;

import org.apache.datawise.backend.common.DbType;
import org.apache.datawise.backend.common.DbTypeCatalogEntry;
import org.apache.datawise.backend.connector.ConnectorCapability;
import org.apache.datawise.backend.connector.DataSourceConnector;
import org.apache.datawise.backend.connector.facade.ConnectorFacade;
import org.apache.datawise.backend.connector.support.ConnectorCapabilityCatalog;
import org.apache.datawise.backend.domain.ConnectorPluginLoadFailure;
import org.apache.datawise.backend.domain.DatasourceDefinitionDto;
import org.apache.datawise.backend.ops.DatabaseOpsRegistry;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
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

    private record CatalogSnapshot(List<DatasourceDefinitionDto> available, Map<String, DatasourceDefinitionDto> byId) {
    }
}
