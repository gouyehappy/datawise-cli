package org.apache.datawise.backend.service;

import org.apache.datawise.backend.common.ProductionWriteBlockedException;
import org.apache.datawise.backend.common.support.ConnectionEnvironmentSupport;
import org.apache.datawise.backend.common.support.TeamRoleSupport;
import org.apache.datawise.backend.configstore.TeamStore;
import org.apache.datawise.backend.connector.api.support.SqlWriteClassifier;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.model.TeamEntity;
import org.apache.datawise.backend.model.TeamMemberEntity;
import org.springframework.stereotype.Service;

/**
 * Server-side enforcement aligned with frontend {@code production-approval-policy.service.ts}.
 */
@Service
public class ProductionWriteGuardService {

    public static final String APPROVAL_SESSION_PREFIX = "prod-approval-";

    private final TeamStore teamStore;

    public ProductionWriteGuardService(TeamStore teamStore) {
        this.teamStore = teamStore;
    }

    public boolean requiresProductionApproval(long userId, ConnectionEntity connection, String sql) {
        if (connection == null || connection.getId() == null || connection.getId().isBlank()) {
            return false;
        }
        if (!SqlWriteClassifier.requiresWriteAccess(sql)) {
            return false;
        }
        if (!ConnectionEnvironmentSupport.isProduction(connection)) {
            return false;
        }
        return hasNonAdminTeamShare(userId, connection.getId());
    }

    public void requireProductionWriteAllowed(
            long userId,
            ConnectionEntity connection,
            String sql,
            String sessionKey
    ) {
        if (!requiresProductionApproval(userId, connection, sql)) {
            return;
        }
        if (isApprovedExecutionSession(sessionKey)) {
            return;
        }
        throw new ProductionWriteBlockedException(userId, connection.getId());
    }

    public static boolean isApprovedExecutionSession(String sessionKey) {
        if (sessionKey == null || sessionKey.isBlank()) {
            return false;
        }
        return sessionKey.startsWith(APPROVAL_SESSION_PREFIX);
    }

    private boolean hasNonAdminTeamShare(long userId, String connectionId) {
        for (TeamMemberEntity membership : teamStore.findMembersByUserId(userId)) {
            TeamEntity team = teamStore.findTeamById(membership.getTeamId()).orElse(null);
            if (team == null || !team.getSharedConnectionIds().contains(connectionId)) {
                continue;
            }
            if (TeamRoleSupport.canManageTeam(membership.getRole())) {
                continue;
            }
            return true;
        }
        return false;
    }
}
