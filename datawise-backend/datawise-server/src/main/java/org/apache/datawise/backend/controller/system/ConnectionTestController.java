package org.apache.datawise.backend.controller.system;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.domain.ConnectionConfig;
import org.apache.datawise.backend.domain.ConnectionTestResult;
import org.apache.datawise.backend.database.connection.ConnectionTestService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/connections")
public class ConnectionTestController {

    private final ConnectionTestService connectionTestService;

    public ConnectionTestController(ConnectionTestService connectionTestService) {
        this.connectionTestService = connectionTestService;
    }

    @PostMapping("/test")
    public ApiResponse<ConnectionTestResult> testConnection(@RequestBody ConnectionConfig config) {
        return ApiResponse.ok(connectionTestService.test(config));
    }
}
