package org.apache.datawise.backend.controller.system;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.domain.JdbcDriverResolveRequest;
import org.apache.datawise.backend.domain.JdbcDriverResolveResult;
import org.apache.datawise.backend.database.connection.DatasourceCatalogService;
import org.apache.datawise.backend.database.connection.JdbcDriverService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.sql.SQLException;
import java.util.Map;

@RestController
@RequestMapping("/api/datasources")
public class DatasourceController {

    private final DatasourceCatalogService datasourceCatalogService;
    private final JdbcDriverService jdbcDriverService;

    public DatasourceController(
            DatasourceCatalogService datasourceCatalogService,
            JdbcDriverService jdbcDriverService
    ) {
        this.datasourceCatalogService = datasourceCatalogService;
        this.jdbcDriverService = jdbcDriverService;
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

    @PostMapping("/drivers/resolve")
    public ApiResponse<JdbcDriverResolveResult> resolveDriver(@RequestBody JdbcDriverResolveRequest request)
            throws SQLException {
        return ApiResponse.ok(jdbcDriverService.resolve(request));
    }
}
