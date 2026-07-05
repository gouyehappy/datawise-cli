package org.apache.datawise.backend.service.team;

import org.apache.datawise.backend.common.UnauthorizedException;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.apache.datawise.backend.common.support.IdGenerator;
import org.apache.datawise.backend.configstore.TeamStore;
import org.apache.datawise.backend.domain.TeamAuditLogDto;
import org.apache.datawise.backend.model.TeamAuditLogEntity;
import org.apache.datawise.backend.model.TeamMemberEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class TeamAuditService {

    private static final Logger logger = LoggerFactory.getLogger(TeamAuditService.class);

    private final TeamStore teamStore;
    private final TeamSupport support;

    public TeamAuditService(TeamStore teamStore, TeamSupport support) {
        this.teamStore = teamStore;
        this.support = support;
    }

    public List<TeamAuditLogDto> listAuditLogs(
            String teamId,
            int limit,
            Long actorUserId,
            Instant since,
            Instant until
    ) {
        support.requireMember(teamId, support.requireUserId());
        return teamStore.findAuditLogsByTeamId(teamId, limit, actorUserId, since, until).stream()
                .map(support::toAuditDto)
                .toList();
    }

    public void recordSqlExecutionAudit(String action, String connectionId, String database, String sql) {
        if (action == null || action.isBlank() || sql == null || sql.isBlank()) {
            return;
        }
        Long userId;
        try {
            userId = support.requireUserId();
        } catch (UnauthorizedException ex) {
            return;
        } catch (RuntimeException ex) {
            ExceptionLogging.recoverable(logger, "Team SQL audit skipped", ex);
            return;
        }
        String detail = buildSqlAuditDetail(connectionId, database, sql);
        recordUserAudit(userId, action.trim(), detail);
    }

    public void recordTerminalAudit(Long userId, String action, String detail) {
        if (userId == null || action == null || action.isBlank()) {
            return;
        }
        recordUserAudit(userId, action.trim(), detail != null ? detail : "");
    }

    public void audit(String teamId, Long actorUserId, String action, String detail) {
        TeamAuditLogEntity log = new TeamAuditLogEntity();
        log.setId(IdGenerator.shortId("ta-"));
        log.setTeamId(teamId);
        log.setActorUserId(actorUserId);
        log.setAction(action);
        log.setDetail(detail);
        log.setCreatedAt(Instant.now());
        teamStore.appendAuditLog(log);
    }

    void recordUserAudit(Long userId, String action, String detail) {
        for (TeamMemberEntity member : teamStore.findMembersByUserId(userId)) {
            try {
                audit(member.getTeamId(), userId, action, detail);
            } catch (RuntimeException ex) {
                ExceptionLogging.recoverable(logger, "Team audit skipped", ex);
            }
        }
    }

    private static String buildSqlAuditDetail(String connectionId, String database, String sql) {
        StringBuilder sb = new StringBuilder();
        if (connectionId != null && !connectionId.isBlank()) {
            sb.append("connectionId=").append(connectionId.trim());
        }
        if (database != null && !database.isBlank()) {
            if (!sb.isEmpty()) {
                sb.append("; ");
            }
            sb.append("database=").append(database.trim());
        }
        if (!sb.isEmpty()) {
            sb.append(" | sql:");
        } else {
            sb.append("sql:");
        }
        sb.append(sql.trim());
        return sb.toString();
    }
}
