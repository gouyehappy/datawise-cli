package org.apache.datawise.backend.controller.system;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.configstore.ConfigDirectoryService;
import org.apache.datawise.backend.domain.HealthStatusDto;
import org.apache.datawise.backend.domain.SystemMetricsDto;
import org.apache.datawise.backend.service.InstanceWorkspaceService;
import org.apache.datawise.backend.server.metrics.SystemMetricsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api")
public class HealthController {

    private final InstanceWorkspaceService instanceWorkspaceService;
    private final SystemMetricsService systemMetricsService;
    private final ConfigDirectoryService configDirectoryService;

    public HealthController(
            InstanceWorkspaceService instanceWorkspaceService,
            SystemMetricsService systemMetricsService,
            ConfigDirectoryService configDirectoryService
    ) {
        this.instanceWorkspaceService = instanceWorkspaceService;
        this.systemMetricsService = systemMetricsService;
        this.configDirectoryService = configDirectoryService;
    }

    @GetMapping("/health")
    public ApiResponse<HealthStatusDto> health() {
        return ApiResponse.ok(new HealthStatusDto(
                "ok",
                "1.0.0",
                Instant.now().toString(),
                instanceWorkspaceService.scriptsRoot(),
                configDirectoryService.getRoot().toString()
        ));
    }

    @GetMapping("/system/metrics")
    public ApiResponse<SystemMetricsDto> systemMetrics() {
        return ApiResponse.ok(systemMetricsService.collect());
    }
}
