package org.apache.datawise.backend.service;

import org.apache.datawise.backend.common.ConnectionAccessDeniedException;
import org.apache.datawise.backend.configstore.TeamStore;
import org.apache.datawise.backend.model.TeamEntity;
import org.apache.datawise.backend.model.TeamMemberEntity;
import org.apache.datawise.backend.common.support.ConnectionAccessLevel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ConnectionAccessServiceTest {

    @TempDir
    Path tempDir;

    private TeamStore teamStore;
    private ConnectionAccessService service;

    @BeforeEach
    void setUp() throws Exception {
        teamStore = TestTeamStoreFactory.create(tempDir);
        service = new ConnectionAccessService(teamStore);
    }

    @Test
    void nonSharedConnectionDefaultsToDdl() {
        assertEquals(ConnectionAccessLevel.DDL, service.resolveAccess(2L, "conn-private"));
    }

    @Test
    void viewerOnSharedConnectionIsReadOnly() {
        seedTeam("team-1", List.of("conn-1"), Map.of(), 1L);
        seedMember("team-1", 2L, "viewer");
        assertEquals(ConnectionAccessLevel.READONLY, service.resolveAccess(2L, "conn-1"));
    }

    @Test
    void memberRespectsReadonlyAccessMap() {
        seedTeam("team-1", List.of("conn-1"), Map.of("conn-1", "readonly"), 1L);
        seedMember("team-1", 2L, "member");
        assertEquals(ConnectionAccessLevel.READONLY, service.resolveAccess(2L, "conn-1"));
    }

    @Test
    void memberRespectsLegacyReadAccessMap() {
        seedTeam("team-1", List.of("conn-1"), Map.of("conn-1", "read"), 1L);
        seedMember("team-1", 2L, "member");
        assertEquals(ConnectionAccessLevel.READONLY, service.resolveAccess(2L, "conn-1"));
    }

    @Test
    void memberRespectsReadwriteAccessMap() {
        seedTeam("team-1", List.of("conn-1"), Map.of("conn-1", "readwrite"), 1L);
        seedMember("team-1", 2L, "member");
        assertEquals(ConnectionAccessLevel.READWRITE, service.resolveAccess(2L, "conn-1"));
    }

    @Test
    void memberDefaultsToDdlWhenAccessNotConfigured() {
        seedTeam("team-1", List.of("conn-1"), Map.of(), 1L);
        seedMember("team-1", 2L, "member");
        assertEquals(ConnectionAccessLevel.DDL, service.resolveAccess(2L, "conn-1"));
    }

    @Test
    void adminOnSharedConnectionCanUseDdl() {
        seedTeam("team-1", List.of("conn-1"), Map.of("conn-1", "readonly"), 1L);
        seedMember("team-1", 2L, "admin");
        assertEquals(ConnectionAccessLevel.DDL, service.resolveAccess(2L, "conn-1"));
    }

    @Test
    void requireDmlAccessThrowsForReadOnly() {
        seedTeam("team-1", List.of("conn-1"), Map.of("conn-1", "readonly"), 1L);
        seedMember("team-1", 2L, "member");
        assertThrows(ConnectionAccessDeniedException.class, () -> service.requireDmlAccess(2L, "conn-1"));
    }

    @Test
    void requireDdlAccessThrowsForReadwrite() {
        seedTeam("team-1", List.of("conn-1"), Map.of("conn-1", "readwrite"), 1L);
        seedMember("team-1", 2L, "member");
        assertThrows(ConnectionAccessDeniedException.class, () -> service.requireDdlAccess(2L, "conn-1"));
    }

    @Test
    void requireSqlWriteAccessAllowsDmlOnReadwrite() {
        seedTeam("team-1", List.of("conn-1"), Map.of("conn-1", "readwrite"), 1L);
        seedMember("team-1", 2L, "member");
        service.requireSqlWriteAccess(2L, "conn-1", "UPDATE t SET a = 1");
    }

    @Test
    void requireSqlWriteAccessBlocksDdlOnReadwrite() {
        seedTeam("team-1", List.of("conn-1"), Map.of("conn-1", "readwrite"), 1L);
        seedMember("team-1", 2L, "member");
        assertThrows(
                ConnectionAccessDeniedException.class,
                () -> service.requireSqlWriteAccess(2L, "conn-1", "CREATE TABLE t (id INT)")
        );
    }

    private void seedTeam(String id, List<String> sharedConnections, Map<String, String> access, Long ownerId) {
        TeamEntity team = new TeamEntity();
        team.setId(id);
        team.setName("Team");
        team.setOwnerUserId(ownerId);
        team.setInviteCode("abc12345");
        team.setCreatedAt(Instant.now());
        team.setSharedConnectionIds(sharedConnections);
        team.setSharedConnectionAccess(access);
        teamStore.saveTeam(team);
    }

    private void seedMember(String teamId, Long userId, String role) {
        TeamMemberEntity member = new TeamMemberEntity();
        member.setTeamId(teamId);
        member.setUserId(userId);
        member.setRole(role);
        member.setJoinedAt(Instant.now());
        teamStore.saveMember(member);
    }
}
