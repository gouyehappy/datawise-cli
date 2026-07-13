package org.apache.datawise.backend.domain;

import java.util.Map;

public record UserPermissionSummaryDto(
        Long id,
        String username,
        String displayName,
        boolean guest,
        boolean admin,
        Map<String, Boolean> featurePermissions
) {
}
