package org.apache.datawise.backend.controller.auth;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.domain.AuthSessionPolicyDto;
import org.apache.datawise.backend.domain.ChangePasswordRequest;
import org.apache.datawise.backend.domain.LoginResult;
import org.apache.datawise.backend.domain.SessionInfo;
import org.apache.datawise.backend.service.AuthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ApiResponse<LoginResult> login(
            @RequestParam String userName,
            @RequestParam String userPassword
    ) {
        return ApiResponse.ok(authService.login(userName, userPassword));
    }

    @PostMapping("/login/guest")
    public ApiResponse<LoginResult> loginGuest() {
        return ApiResponse.ok(authService.loginAsGuest());
    }

    @GetMapping("/api/auth/session")
    public ApiResponse<SessionInfo> currentSession() {
        return ApiResponse.ok(authService.getCurrentSession());
    }

    @GetMapping("/api/auth/session-policy")
    public ApiResponse<AuthSessionPolicyDto> sessionPolicy() {
        return ApiResponse.ok(authService.getSessionPolicy());
    }

    @PutMapping("/api/auth/session-policy")
    public ApiResponse<AuthSessionPolicyDto> updateSessionPolicy(@RequestBody AuthSessionPolicyDto policy) {
        return ApiResponse.ok(authService.updateSessionPolicy(policy));
    }

    @PostMapping("/signOut")
    public ApiResponse<Void> signOut() {
        authService.signOut();
        return ApiResponse.ok(null);
    }

    @PostMapping("/api/auth/change-password")
    public ApiResponse<Void> changePassword(@RequestBody ChangePasswordRequest request) {
        authService.changePassword(request.currentPassword(), request.newPassword());
        return ApiResponse.ok(null);
    }
}
