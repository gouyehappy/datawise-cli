package org.apache.datawise.backend.lineage.api;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.domain.LineageGraphDto;
import org.apache.datawise.backend.domain.LineageImpactDto;
import org.apache.datawise.backend.domain.ParseLineageRequest;
import org.apache.datawise.backend.lineage.service.LineageService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@RestController
@RequestMapping("/api/lineage/view-models")
public class LineageController {

    private final LineageService lineageService;

    public LineageController(LineageService lineageService) {
        this.lineageService = lineageService;
    }

    @GetMapping
    public ApiResponse<LineageGraphDto> getLineage(
            @RequestParam String connectionId,
            @RequestParam String instanceName,
            @RequestParam String name,
            @RequestParam(defaultValue = "false") boolean forceRefresh
    ) throws IOException {
        return ApiResponse.ok(lineageService.getViewModelLineage(connectionId, instanceName, name, forceRefresh));
    }

    @GetMapping("/impact")
    public ApiResponse<LineageImpactDto> impact(
            @RequestParam String connectionId,
            @RequestParam String instanceName,
            @RequestParam String name
    ) throws IOException {
        return ApiResponse.ok(lineageService.findDownstreamImpact(connectionId, instanceName, name));
    }

    @PostMapping("/parse")
    public ApiResponse<LineageGraphDto> parse(@RequestBody ParseLineageRequest request) throws IOException {
        return ApiResponse.ok(lineageService.parseLineage(request));
    }
}
