package org.apache.datawise.backend.security;

import org.apache.datawise.backend.common.UnauthorizedException;
import org.apache.datawise.backend.service.UserAccessPolicy;

public final class HeadlessMigrationAuth {

    public static final String API_TOKEN_FORBIDDEN = "API_TOKEN_FORBIDDEN";

    private HeadlessMigrationAuth() {
    }

    public static void requireMigrationAccess() {
        if (UserContext.getUserId() == null) {
            throw new UnauthorizedException();
        }
        if (UserContext.isGuest()) {
            throw new IllegalArgumentException(UserAccessPolicy.GUEST_NOT_ALLOWED);
        }
        if (UserContext.isApiTokenAuth() && !UserContext.hasApiTokenScope(ApiTokenScopes.MIGRATION)) {
            throw new IllegalArgumentException(API_TOKEN_FORBIDDEN);
        }
    }
}
