package org.apache.datawise.backend.controller.platform;

import org.apache.datawise.backend.ai.canvas.AnalysisCanvasService;
import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.domain.AnalysisCanvasDetailDto;
import org.apache.datawise.backend.domain.AnalysisCanvasSummaryDto;
import org.apache.datawise.backend.domain.RerunAnalysisCanvasRequest;
import org.apache.datawise.backend.domain.SaveAnalysisCanvasRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/platform/analysis-canvas")
public class AnalysisCanvasController {

    private final AnalysisCanvasService canvasService;

    public AnalysisCanvasController(AnalysisCanvasService canvasService) {
        this.canvasService = canvasService;
    }

    @GetMapping
    public ApiResponse<List<AnalysisCanvasSummaryDto>> list() {
        return ApiResponse.ok(canvasService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<AnalysisCanvasDetailDto> get(@PathVariable String id) {
        return ApiResponse.ok(canvasService.get(id));
    }

    @PutMapping
    public ApiResponse<AnalysisCanvasDetailDto> save(@RequestBody SaveAnalysisCanvasRequest request) {
        return ApiResponse.ok(canvasService.save(request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        canvasService.delete(id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/rerun")
    public ApiResponse<AnalysisCanvasService.RerunAnalysisCanvasResult> rerun(
            @RequestBody RerunAnalysisCanvasRequest request
    ) {
        return ApiResponse.ok(canvasService.rerun(request));
    }
}
