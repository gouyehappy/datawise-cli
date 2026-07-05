package org.apache.datawise.backend.controller.ai;

import org.apache.datawise.backend.ai.rag.AiRagAdminService;
import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.ai.domain.AiRagRebuildRequest;
import org.apache.datawise.backend.ai.domain.AiRagRebuildResultDto;
import org.apache.datawise.backend.ai.domain.AiRagStatusDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/rag")
public class AiRagController {

    private final AiRagAdminService ragAdminService;

    public AiRagController(AiRagAdminService ragAdminService) {
        this.ragAdminService = ragAdminService;
    }

    @GetMapping("/status")
    public ApiResponse<AiRagStatusDto> status(
            @RequestParam(required = false) String connectionId,
            @RequestParam(required = false) String database
    ) {
        return ApiResponse.ok(ragAdminService.status(connectionId, database));
    }

    @PostMapping("/rebuild")
    public ApiResponse<AiRagRebuildResultDto> rebuild(@RequestBody(required = false) AiRagRebuildRequest request) {
        String connectionId = request != null ? request.connectionId() : null;
        String database = request != null ? request.database() : null;
        return ApiResponse.ok(ragAdminService.rebuild(connectionId, database));
    }
}
