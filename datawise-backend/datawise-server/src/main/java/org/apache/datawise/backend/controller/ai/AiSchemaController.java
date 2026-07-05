package org.apache.datawise.backend.controller.ai;

import org.apache.datawise.backend.ai.schema.AiSchemaContextService;
import org.apache.datawise.backend.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/ai/schema")
public class AiSchemaController {

    private final AiSchemaContextService schemaContextService;

    public AiSchemaController(AiSchemaContextService schemaContextService) {
        this.schemaContextService = schemaContextService;
    }

    @GetMapping("/tables")
    public ApiResponse<List<String>> listTables(
            @RequestParam String connectionId,
            @RequestParam(required = false) String database
    ) {
        return ApiResponse.ok(schemaContextService.listTableNames(connectionId, database));
    }
}
