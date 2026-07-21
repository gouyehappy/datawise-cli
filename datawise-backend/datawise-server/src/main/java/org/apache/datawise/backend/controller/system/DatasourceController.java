package org.apache.datawise.backend.controller.system;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.domain.ConnectorPluginReloadResultDto;
import org.apache.datawise.backend.domain.InstallConnectorBatchRequest;
import org.apache.datawise.backend.domain.InstallConnectorBatchResultDto;
import org.apache.datawise.backend.domain.InstallConnectorPluginRequest;
import org.apache.datawise.backend.domain.InstallConnectorPluginResultDto;
import org.apache.datawise.backend.domain.JdbcDriverCatalogDto;
import org.apache.datawise.backend.domain.JdbcDriverResolveRequest;
import org.apache.datawise.backend.domain.JdbcDriverResolveResult;
import org.apache.datawise.backend.domain.UninstallConnectorPluginResultDto;
import org.apache.datawise.backend.database.connection.DatasourceCatalogService;
import org.apache.datawise.backend.database.connection.JdbcDriverService;
import org.apache.datawise.backend.service.UserAdminPolicy;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.sql.SQLException;
import java.util.Map;

@RestController
@RequestMapping("/api/datasources")
public class DatasourceController {

    private final DatasourceCatalogService datasourceCatalogService;
    private final JdbcDriverService jdbcDriverService;
    private final UserAdminPolicy userAdminPolicy;

    public DatasourceController(
            DatasourceCatalogService datasourceCatalogService,
            JdbcDriverService jdbcDriverService,
            UserAdminPolicy userAdminPolicy
    ) {
        this.datasourceCatalogService = datasourceCatalogService;
        this.jdbcDriverService = jdbcDriverService;
        this.userAdminPolicy = userAdminPolicy;
    }

    @GetMapping
    public ApiResponse<Map<String, Object>> listDatasources() {
        return ApiResponse.ok(Map.of(
                "datasources", datasourceCatalogService.listAvailable(),
                "loadedPluginJars", datasourceCatalogService.loadedPluginJarNames(),
                "pluginLoadFailures", datasourceCatalogService.pluginLoadFailures()
        ));
    }

    @GetMapping("/market")
    public ApiResponse<Map<String, Object>> listConnectorMarket() {
        var manifest = datasourceCatalogService.pluginManifest().orElse(null);
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("connectors", datasourceCatalogService.listMarket());
        payload.put("loadedPluginJars", datasourceCatalogService.loadedPluginJarNames());
        payload.put("pluginLoadFailures", datasourceCatalogService.pluginLoadFailures());
        if (manifest != null) {
            payload.put("manifest", Map.of(
                    "schemaVersion", manifest.schemaVersion(),
                    "updatedAt", manifest.updatedAt() != null ? manifest.updatedAt() : "",
                    "channel", manifest.channel() != null ? manifest.channel() : "",
                    "pluginCount", manifest.plugins().size()
            ));
        }
        return ApiResponse.ok(payload);
    }

    @PostMapping("/market/install")
    public ApiResponse<InstallConnectorPluginResultDto> installConnectorPlugin(
            @RequestBody InstallConnectorPluginRequest request
    ) {
        userAdminPolicy.requireAdminUser();
        String connectorId = request != null ? request.connectorId() : null;
        return ApiResponse.ok(datasourceCatalogService.installRemotePlugin(connectorId));
    }

    @PostMapping("/market/install-batch")
    public ApiResponse<InstallConnectorBatchResultDto> installConnectorPluginsBatch(
            @RequestBody InstallConnectorBatchRequest request
    ) {
        userAdminPolicy.requireAdminUser();
        return ApiResponse.ok(datasourceCatalogService.installRemotePluginsBatch(
                request != null ? request.connectorIds() : null
        ));
    }

    @DeleteMapping("/market/{connectorId}")
    public ApiResponse<UninstallConnectorPluginResultDto> uninstallConnectorPlugin(
            @PathVariable String connectorId
    ) {
        userAdminPolicy.requireAdminUser();
        return ApiResponse.ok(datasourceCatalogService.uninstallPlugin(connectorId));
    }

    /** Deletes plugin JARs on disk that are not currently loaded (classpath-shadowed leftovers). */
    @PostMapping("/market/cleanup-redundant")
    public ApiResponse<org.apache.datawise.backend.domain.CleanupConnectorPluginsResultDto> cleanupRedundantPlugins() {
        userAdminPolicy.requireAdminUser();
        return ApiResponse.ok(datasourceCatalogService.cleanupRedundantPluginJars());
    }

    /** Hot-reload connector JARs from {@code config/plugins} without restarting the process. */
    @PostMapping("/plugins/reload")
    public ApiResponse<ConnectorPluginReloadResultDto> reloadConnectorPlugins() {
        userAdminPolicy.requireAdminUser();
        return ApiResponse.ok(datasourceCatalogService.reloadPlugins());
    }

    @GetMapping("/drivers")
    public ApiResponse<JdbcDriverCatalogDto> listDrivers() {
        return ApiResponse.ok(jdbcDriverService.listCached());
    }

    @PostMapping("/drivers/install")
    public ApiResponse<JdbcDriverResolveResult> installDriver(@RequestBody JdbcDriverResolveRequest request)
            throws SQLException {
        return ApiResponse.ok(jdbcDriverService.install(request));
    }

    @PostMapping("/drivers/resolve")
    public ApiResponse<JdbcDriverResolveResult> resolveDriver(@RequestBody JdbcDriverResolveRequest request)
            throws SQLException {
        return ApiResponse.ok(jdbcDriverService.resolve(request));
    }

    @DeleteMapping("/drivers")
    public ApiResponse<Map<String, Object>> deleteDriver(@RequestParam("path") String relativePath) {
        userAdminPolicy.requireAdminUser();
        String path = relativePath == null ? "" : relativePath;
        boolean deleted = jdbcDriverService.deleteCached(path);
        return ApiResponse.ok(Map.of(
                "deleted", deleted,
                "relativePath", path
        ));
    }

    @DeleteMapping("/drivers/bundles/{bundleDir}")
    public ApiResponse<Map<String, Object>> deleteDriverBundle(@PathVariable String bundleDir) {
        userAdminPolicy.requireAdminUser();
        int deleted = jdbcDriverService.deleteBundle(bundleDir);
        return ApiResponse.ok(Map.of(
                "deletedCount", deleted,
                "bundleDir", bundleDir == null ? "" : bundleDir
        ));
    }

    @DeleteMapping("/drivers/families/{familyId}")
    public ApiResponse<Map<String, Object>> deleteDriverFamily(@PathVariable String familyId) {
        userAdminPolicy.requireAdminUser();
        int deleted = jdbcDriverService.deleteFamily(familyId);
        return ApiResponse.ok(Map.of(
                "deletedCount", deleted,
                "familyId", familyId == null ? "" : familyId
        ));
    }
}
