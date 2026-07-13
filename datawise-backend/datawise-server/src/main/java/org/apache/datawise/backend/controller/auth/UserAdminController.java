package org.apache.datawise.backend.controller.auth;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.domain.UpdateUserPermissionsRequest;
import org.apache.datawise.backend.domain.UserPermissionSummaryDto;
import org.apache.datawise.backend.service.UserAdminService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
public class UserAdminController {

    private final UserAdminService userAdminService;

    public UserAdminController(UserAdminService userAdminService) {
        this.userAdminService = userAdminService;
    }

    @GetMapping
    public ApiResponse<List<UserPermissionSummaryDto>> listUsers() {
        return ApiResponse.ok(userAdminService.listUsers());
    }

    @PutMapping("/{userId}/permissions")
    public ApiResponse<UserPermissionSummaryDto> updateUserPermissions(
            @PathVariable long userId,
            @RequestBody UpdateUserPermissionsRequest request
    ) {
        return ApiResponse.ok(userAdminService.updateUserPermissions(userId, request));
    }
}
