package org.apache.datawise.backend.controller.platform;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.domain.DataQualityGateRequest;
import org.apache.datawise.backend.domain.DataQualityGateResultDto;
import org.apache.datawise.backend.domain.ScheduledTaskDto;
import org.apache.datawise.backend.platform.schedule.ScheduledTaskService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Data-quality rule catalog and release-gate evaluation.
 */
@RestController
@RequestMapping("/api/platform/data-quality")
public class DataQualityController {

    private final ScheduledTaskService scheduledTaskService;

    public DataQualityController(ScheduledTaskService scheduledTaskService) {
        this.scheduledTaskService = scheduledTaskService;
    }

    /** List {@code data_quality} scheduled tasks (optional connection/database scope). */
    @GetMapping("/rules")
    public ApiResponse<List<ScheduledTaskDto>> listRules(
            @RequestParam(required = false) String connectionId,
            @RequestParam(required = false) String database
    ) {
        return ApiResponse.ok(scheduledTaskService.listDataQualityRules(connectionId, database));
    }

    /**
     * Evaluate release-gate suite. Always HTTP 200 with {@code passed} flag so CI can branch
     * on the body without treating assertion failures as transport errors.
     */
    @PostMapping("/gate")
    public ApiResponse<DataQualityGateResultDto> evaluateGate(@RequestBody(required = false) DataQualityGateRequest request) {
        return ApiResponse.ok(scheduledTaskService.evaluateDataQualityGate(
                request != null ? request : new DataQualityGateRequest(null, null, null, null)
        ));
    }
}
