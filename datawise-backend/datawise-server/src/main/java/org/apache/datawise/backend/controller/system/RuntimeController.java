package org.apache.datawise.backend.controller.system;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.common.UnauthorizedException;
import org.apache.datawise.backend.database.connection.RuntimeOverviewService;
import org.apache.datawise.backend.domain.RuntimeOverviewDto;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.service.UserAccessPolicy;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/runtime")
public class RuntimeController {

    private final RuntimeOverviewService runtimeOverviewService;
    private final UserAccessPolicy userAccessPolicy;

    public RuntimeController(RuntimeOverviewService runtimeOverviewService, UserAccessPolicy userAccessPolicy) {
        this.runtimeOverviewService = runtimeOverviewService;
        this.userAccessPolicy = userAccessPolicy;
    }

    @GetMapping
    public ApiResponse<RuntimeOverviewDto> overview() {
        if (UserContext.getUserId() == null) {
            throw new UnauthorizedException();
        }
        userAccessPolicy.requireRegisteredUser();
        return ApiResponse.ok(runtimeOverviewService.overview());
    }

    @GetMapping("/jre")
    public ApiResponse<RuntimeOverviewDto.RuntimeJreDto> jre() {
        if (UserContext.getUserId() == null) {
            throw new UnauthorizedException();
        }
        userAccessPolicy.requireRegisteredUser();
        return ApiResponse.ok(runtimeOverviewService.overview().jre());
    }
}
