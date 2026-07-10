package org.apache.datawise.backend.controller.system;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.domain.ConnectionConfig;
import org.apache.datawise.backend.domain.ConnectionTestResult;
import org.apache.datawise.backend.database.connection.ConnectionTestService;
import org.apache.datawise.backend.service.UserAccessPolicy;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/connections")
public class ConnectionTestController {

    private final ConnectionTestService connectionTestService;
    private final UserAccessPolicy userAccessPolicy;

    public ConnectionTestController(ConnectionTestService connectionTestService, UserAccessPolicy userAccessPolicy) {
        this.connectionTestService = connectionTestService;
        this.userAccessPolicy = userAccessPolicy;
    }

    @PostMapping("/test")
    public ApiResponse<ConnectionTestResult> testConnection(@RequestBody ConnectionConfig config) {
        userAccessPolicy.requireRegisteredUser();
        return ApiResponse.ok(connectionTestService.test(config));
    }
}
