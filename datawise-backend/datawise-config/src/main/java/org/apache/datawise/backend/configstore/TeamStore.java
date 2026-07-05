package org.apache.datawise.backend.configstore;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.configstore.io.JsonSnapshotFile;
import org.apache.datawise.backend.configstore.team.TeamSnapshot;
import org.apache.datawise.backend.configstore.support.TeamAuditLogFilters;
import org.apache.datawise.backend.model.TeamAuditLogEntity;
import org.apache.datawise.backend.model.TeamEntity;
import org.apache.datawise.backend.model.TeamInviteEntity;
import org.apache.datawise.backend.model.TeamMemberEntity;
import org.apache.datawise.backend.model.TeamProductionApprovalEntity;
import org.apache.datawise.backend.model.TeamSharedAiSessionEntity;
import org.apache.datawise.backend.model.TeamSharedQueryEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.time.Instant;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class TeamStore {

    private final JsonSnapshotFile<TeamSnapshot> snapshotFile;
    private final List<TeamEntity> teams = new CopyOnWriteArrayList<>();
    private final List<TeamMemberEntity> members = new CopyOnWriteArrayList<>();
    private final List<TeamInviteEntity> invites = new CopyOnWriteArrayList<>();
    private final List<TeamAuditLogEntity> auditLogs = new CopyOnWriteArrayList<>();
    private final List<TeamSharedAiSessionEntity> sharedAiSessions = new CopyOnWriteArrayList<>();
    private final List<TeamSharedQueryEntity> sharedQueries = new CopyOnWriteArrayList<>();
    private final List<TeamProductionApprovalEntity> productionApprovals = new CopyOnWriteArrayList<>();

    @Autowired
    public TeamStore(ConfigDirectoryService configDirectory, ObjectMapper objectMapper) {
        this.snapshotFile = new JsonSnapshotFile<>(
                configDirectory,
                objectMapper,
                ConfigPaths.TEAMS,
                TeamSnapshot.class,
                TeamSnapshot.empty()
        );
        reloadFromDisk();
    }

    private void reloadFromDisk() {
        TeamSnapshot snapshot = snapshotFile.get();
        teams.clear();
        teams.addAll(snapshot.teams() != null ? snapshot.teams() : List.of());
        members.clear();
        members.addAll(snapshot.members() != null ? snapshot.members() : List.of());
        invites.clear();
        invites.addAll(snapshot.invites() != null ? snapshot.invites() : List.of());
        auditLogs.clear();
        auditLogs.addAll(snapshot.auditLogs() != null ? snapshot.auditLogs() : List.of());
        sharedAiSessions.clear();
        sharedAiSessions.addAll(snapshot.sharedAiSessions() != null ? snapshot.sharedAiSessions() : List.of());
        sharedQueries.clear();
        sharedQueries.addAll(snapshot.sharedQueries() != null ? snapshot.sharedQueries() : List.of());
        productionApprovals.clear();
        productionApprovals.addAll(snapshot.productionApprovals() != null ? snapshot.productionApprovals() : List.of());
    }

    public List<TeamMemberEntity> findMembersByUserId(Long userId) {
        return members.stream().filter(member -> userId.equals(member.getUserId())).toList();
    }

    public List<TeamMemberEntity> findMembersByTeamId(String teamId) {
        return members.stream().filter(member -> teamId.equals(member.getTeamId())).toList();
    }

    public Optional<TeamMemberEntity> findMember(String teamId, Long userId) {
        return members.stream()
                .filter(member -> teamId.equals(member.getTeamId()) && userId.equals(member.getUserId()))
                .findFirst();
    }

    public Optional<TeamEntity> findTeamById(String teamId) {
        return teams.stream().filter(team -> teamId.equals(team.getId())).findFirst();
    }

    public long countMembersByTeamId(String teamId) {
        return members.stream().filter(member -> teamId.equals(member.getTeamId())).count();
    }

    public synchronized TeamEntity saveTeam(TeamEntity team) {
        teams.removeIf(existing -> existing.getId().equals(team.getId()));
        teams.add(team);
        persistToDisk();
        return team;
    }

    public synchronized TeamMemberEntity saveMember(TeamMemberEntity member) {
        members.removeIf(existing ->
                existing.getTeamId().equals(member.getTeamId()) && existing.getUserId().equals(member.getUserId()));
        members.add(member);
        persistToDisk();
        return member;
    }

    public synchronized void removeMember(String teamId, Long userId) {
        members.removeIf(member -> teamId.equals(member.getTeamId()) && userId.equals(member.getUserId()));
        persistToDisk();
    }

    public List<TeamInviteEntity> findInvitesByTeamId(String teamId) {
        return invites.stream()
                .filter(invite -> teamId.equals(invite.getTeamId()))
                .sorted(Comparator.comparing(TeamInviteEntity::getRequestedAt).reversed())
                .toList();
    }

    public Optional<TeamInviteEntity> findInviteById(String inviteId) {
        return invites.stream().filter(invite -> inviteId.equals(invite.getId())).findFirst();
    }

    public Optional<TeamInviteEntity> findPendingInvite(String teamId, Long userId) {
        return invites.stream()
                .filter(invite -> teamId.equals(invite.getTeamId())
                        && userId.equals(invite.getUserId())
                        && "pending".equalsIgnoreCase(invite.getStatus()))
                .findFirst();
    }

    public List<TeamInviteEntity> findInvitesByUserId(Long userId) {
        return invites.stream()
                .filter(invite -> userId.equals(invite.getUserId()))
                .sorted(Comparator.comparing(TeamInviteEntity::getRequestedAt).reversed())
                .toList();
    }

    public long countPendingInvitesByTeamId(String teamId) {
        return invites.stream()
                .filter(invite -> teamId.equals(invite.getTeamId())
                        && "pending".equalsIgnoreCase(invite.getStatus()))
                .count();
    }

    public synchronized TeamInviteEntity saveInvite(TeamInviteEntity invite) {
        invites.removeIf(existing -> existing.getId().equals(invite.getId()));
        invites.add(invite);
        persistToDisk();
        return invite;
    }

    public List<TeamAuditLogEntity> findAuditLogsByTeamId(String teamId, int limit) {
        return findAuditLogsByTeamId(teamId, limit, null, null, null);
    }

    public List<TeamAuditLogEntity> findAuditLogsByTeamId(
            String teamId,
            int limit,
            Long actorUserId,
            Instant since,
            Instant until
    ) {
        return auditLogs.stream()
                .filter(log -> teamId.equals(log.getTeamId()))
                .filter(log -> TeamAuditLogFilters.matches(log, actorUserId, since, until))
                .sorted(Comparator.comparing(TeamAuditLogEntity::getCreatedAt).reversed())
                .limit(Math.max(1, Math.min(limit, 500)))
                .toList();
    }

    public synchronized TeamAuditLogEntity appendAuditLog(TeamAuditLogEntity log) {
        auditLogs.add(log);
        while (auditLogs.size() > 500) {
            auditLogs.remove(0);
        }
        persistToDisk();
        return log;
    }

    public Optional<TeamEntity> findTeamByInviteCode(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        String normalized = code.trim();
        return teams.stream()
                .filter(team -> team.getInviteCode() != null && team.getInviteCode().equalsIgnoreCase(normalized))
                .findFirst();
    }

    public synchronized TeamSharedAiSessionEntity saveSharedAiSession(TeamSharedAiSessionEntity session) {
        sharedAiSessions.removeIf(existing -> existing.getId().equals(session.getId()));
        sharedAiSessions.add(session);
        while (sharedAiSessions.size() > 200) {
            sharedAiSessions.remove(0);
        }
        persistToDisk();
        return session;
    }

    public List<TeamSharedAiSessionEntity> findSharedAiSessionsByTeamId(String teamId) {
        return sharedAiSessions.stream()
                .filter(session -> teamId.equals(session.getTeamId()))
                .sorted(Comparator.comparing(TeamSharedAiSessionEntity::getSharedAt).reversed())
                .toList();
    }

    public Optional<TeamSharedAiSessionEntity> findSharedAiSessionById(String teamId, String sessionId) {
        return sharedAiSessions.stream()
                .filter(session -> teamId.equals(session.getTeamId()) && sessionId.equals(session.getId()))
                .findFirst();
    }

    public synchronized TeamSharedQueryEntity saveSharedQuery(TeamSharedQueryEntity query) {
        sharedQueries.removeIf(existing -> existing.getId().equals(query.getId()));
        sharedQueries.add(query);
        while (sharedQueries.size() > 500) {
            sharedQueries.remove(0);
        }
        persistToDisk();
        return query;
    }

    public synchronized void deleteSharedQuery(String teamId, String queryId) {
        sharedQueries.removeIf(query -> teamId.equals(query.getTeamId()) && queryId.equals(query.getId()));
        persistToDisk();
    }

    public List<TeamSharedQueryEntity> findSharedQueriesByTeamId(String teamId) {
        return sharedQueries.stream()
                .filter(query -> teamId.equals(query.getTeamId()))
                .sorted(Comparator.comparing(TeamSharedQueryEntity::getUpdatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .toList();
    }

    public Optional<TeamSharedQueryEntity> findSharedQueryById(String teamId, String queryId) {
        return sharedQueries.stream()
                .filter(query -> teamId.equals(query.getTeamId()) && queryId.equals(query.getId()))
                .findFirst();
    }

    public synchronized TeamProductionApprovalEntity saveProductionApproval(TeamProductionApprovalEntity approval) {
        productionApprovals.removeIf(existing -> existing.getId().equals(approval.getId()));
        productionApprovals.add(approval);
        while (productionApprovals.size() > 500) {
            productionApprovals.remove(0);
        }
        persistToDisk();
        return approval;
    }

    public List<TeamProductionApprovalEntity> findProductionApprovalsByTeamId(String teamId, String status) {
        return productionApprovals.stream()
                .filter(item -> teamId.equals(item.getTeamId()))
                .filter(item -> status == null || status.isBlank() || status.equalsIgnoreCase(item.getStatus()))
                .sorted(Comparator.comparing(
                        TeamProductionApprovalEntity::getRequestedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    public Optional<TeamProductionApprovalEntity> findProductionApprovalById(String teamId, String approvalId) {
        return productionApprovals.stream()
                .filter(item -> teamId.equals(item.getTeamId()) && approvalId.equals(item.getId()))
                .findFirst();
    }

    private void persistToDisk() {
        snapshotFile.replace(new TeamSnapshot(
                new ArrayList<>(teams),
                new ArrayList<>(members),
                new ArrayList<>(invites),
                new ArrayList<>(auditLogs),
                new ArrayList<>(sharedAiSessions),
                new ArrayList<>(sharedQueries),
                new ArrayList<>(productionApprovals)
        ));
    }
}
