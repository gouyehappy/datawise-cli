package org.apache.datawise.backend.controller.platform;

import org.apache.datawise.backend.ai.semantic.SemanticLayerService;
import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.domain.AutoGenerateSemanticMetricsRequest;
import org.apache.datawise.backend.domain.SaveSemanticMetricRequest;
import org.apache.datawise.backend.domain.SemanticMetricDto;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/platform/semantic-metrics")
public class SemanticLayerController {

    private final SemanticLayerService semanticLayerService;

    public SemanticLayerController(SemanticLayerService semanticLayerService) {
        this.semanticLayerService = semanticLayerService;
    }

    @GetMapping
    public ApiResponse<List<SemanticMetricDto>> list(
            @RequestParam(required = false) String connectionId,
            @RequestParam(required = false) String database
    ) {
        return ApiResponse.ok(semanticLayerService.list(connectionId, database));
    }

    @PutMapping
    public ApiResponse<SemanticMetricDto> save(@RequestBody SaveSemanticMetricRequest request) {
        return ApiResponse.ok(semanticLayerService.save(request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        semanticLayerService.delete(id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/auto-generate")
    public ApiResponse<List<SemanticMetricDto>> autoGenerate(
            @RequestBody AutoGenerateSemanticMetricsRequest request
    ) {
        return ApiResponse.ok(semanticLayerService.autoGenerate(request));
    }
}
