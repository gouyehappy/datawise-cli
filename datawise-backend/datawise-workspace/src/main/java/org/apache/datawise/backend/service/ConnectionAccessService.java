package org.apache.datawise.backend.service;

import org.apache.datawise.backend.common.ConnectionAccessDeniedException;
import org.apache.datawise.backend.configstore.TeamStore;
import org.apache.datawise.backend.model.TeamEntity;
import org.apache.datawise.backend.model.TeamMemberEntity;
import org.apache.datawise.backend.common.support.ConnectionAccessLevel;
import org.apache.datawise.backend.common.support.ConnectionAccessLevelSupport;
import org.apache.datawise.backend.connector.api.support.SqlWriteClassifier;
import org.apache.datawise.backend.common.support.TeamRoleSupport;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

@Service
public class ConnectionAccessService {

    private final TeamStore teamStore;

    public ConnectionAccessService(TeamStore teamStore) {
        this.teamStore = teamStore;
    }

    public ConnectionAccessLevel resolveAccess(Long userId, String connectionId) {
        if (connectionId == null || connectionId.isBlank()) {
            return ConnectionAccessLevel.DDL;
        }

        ConnectionAccessLevel effective = null;
        for (TeamMemberEntity membership : teamStore.findMembersByUserId(userId)) {
            TeamEntity team = teamStore.findTeamById(membership.getTeamId()).orElse(null);
            if (team == null || !team.getSharedConnectionIds().contains(connectionId)) {
                continue;
            }
            ConnectionAccessLevel level = levelForMembership(team, membership, connectionId);
            effective = effective == null ? level : effective.restrict(level);
        }

        return effective != null ? effective : ConnectionAccessLevel.DDL;
    }

    public void requireDmlAccess(Long userId, String connectionId) {
        if (!resolveAccess(userId, connectionId).allowsDml()) {
            throw new ConnectionAccessDeniedException(connectionId);
        }
    }

    public void requireDdlAccess(Long userId, String connectionId) {
        if (!resolveAccess(userId, connectionId).allowsDdl()) {
            throw new ConnectionAccessDeniedException(connectionId);
        }
    }

    /** Legacy name: full DDL access required (migrations, etc.). */
    public void requireWriteAccess(Long userId, String connectionId) {
        requireDdlAccess(userId, connectionId);
    }

    public void requireSqlWriteAccess(Long userId, String connectionId, String sql) {
        if (!SqlWriteClassifier.requiresWriteAccess(sql)) {
            return;
        }
        ConnectionAccessLevel level = resolveAccess(userId, connectionId);
        if (SqlWriteClassifier.requiresDdlAccess(sql)) {
            if (!level.allowsDdl()) {
                throw new ConnectionAccessDeniedException(connectionId);
            }
            return;
        }
        if (!level.allowsDml()) {
            throw new ConnectionAccessDeniedException(connectionId);
        }
    }

    public Set<String> listRestrictedConnectionIds(Long userId) {
        Set<String> restricted = new HashSet<>();
        for (TeamMemberEntity membership : teamStore.findMembersByUserId(userId)) {
            TeamEntity team = teamStore.findTeamById(membership.getTeamId()).orElse(null);
            if (team == null) {
                continue;
            }
            for (String connectionId : team.getSharedConnectionIds()) {
                if (!resolveAccess(userId, connectionId).allowsDml()) {
                    restricted.add(connectionId);
                }
            }
        }
        return restricted;
    }

    private ConnectionAccessLevel levelForMembership(
            TeamEntity team,
            TeamMemberEntity member,
            String connectionId
    ) {
        String role = TeamRoleSupport.normalizeRole(member.getRole());
        if (TeamRoleSupport.isViewer(role)) {
            return ConnectionAccessLevel.READONLY;
        }
        if (TeamRoleSupport.canManageTeam(role)) {
            return ConnectionAccessLevel.DDL;
        }
        return ConnectionAccessLevelSupport.fromStored(team.getSharedConnectionAccess().get(connectionId));
    }
}
