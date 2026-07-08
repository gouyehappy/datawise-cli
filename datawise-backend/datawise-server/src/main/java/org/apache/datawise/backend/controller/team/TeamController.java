package org.apache.datawise.backend.controller.team;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.domain.CreateTeamRequest;
import org.apache.datawise.backend.domain.JoinTeamRequest;
import org.apache.datawise.backend.domain.JoinTeamResultDto;
import org.apache.datawise.backend.domain.AddTeamSharedQueryCommentRequest;
import org.apache.datawise.backend.domain.ShareTeamAiSessionRequest;
import org.apache.datawise.backend.domain.ShareTeamSharedQueryRequest;
import org.apache.datawise.backend.domain.TeamSharedQueryCommentDto;
import org.apache.datawise.backend.domain.TeamSharedQueryDetailDto;
import org.apache.datawise.backend.domain.TeamSharedQuerySummaryDto;
import org.apache.datawise.backend.domain.RejectTeamProductionApprovalRequest;
import org.apache.datawise.backend.domain.SubmitTeamProductionApprovalRequest;
import org.apache.datawise.backend.domain.TeamProductionApprovalDetailDto;
import org.apache.datawise.backend.domain.TeamProductionApprovalSummaryDto;
import org.apache.datawise.backend.domain.UpdateTeamSharedQueryRequest;
import org.apache.datawise.backend.domain.TeamAuditLogDto;
import org.apache.datawise.backend.domain.TeamInviteDto;
import org.apache.datawise.backend.domain.TeamJoinRequestDto;
import org.apache.datawise.backend.domain.TeamMemberDto;
import org.apache.datawise.backend.domain.TeamSharedAiSessionDetailDto;
import org.apache.datawise.backend.domain.TeamSharedAiSessionDto;
import org.apache.datawise.backend.domain.TeamSummaryDto;
import org.apache.datawise.backend.domain.UpdateOnCallConnectionsRequest;
import org.apache.datawise.backend.domain.UpdateSharedConsolesRequest;
import org.apache.datawise.backend.domain.UpdateSharedConnectionsRequest;
import org.apache.datawise.backend.domain.UpdateShareSqlHistoryRequest;
import org.apache.datawise.backend.domain.UpdateTeamMemberRoleRequest;
import org.apache.datawise.backend.domain.UpdateTeamSettingsRequest;
import org.apache.datawise.backend.database.team.ProductionApprovalService;
import org.apache.datawise.backend.service.TeamService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/teams")
public class TeamController {

    private final TeamService teamService;
    private final ProductionApprovalService productionApprovalService;

    public TeamController(TeamService teamService, ProductionApprovalService productionApprovalService) {
        this.teamService = teamService;
        this.productionApprovalService = productionApprovalService;
    }

    @GetMapping
    public ApiResponse<List<TeamSummaryDto>> listTeams() {
        return ApiResponse.ok(teamService.listTeams());
    }

    @PostMapping
    public ApiResponse<TeamSummaryDto> createTeam(@RequestBody CreateTeamRequest request) {
        return ApiResponse.ok(teamService.createTeam(request));
    }

    @PostMapping("/join")
    public ApiResponse<JoinTeamResultDto> joinTeam(@RequestBody JoinTeamRequest request) {
        return ApiResponse.ok(teamService.joinTeam(request));
    }

    @GetMapping("/join-requests")
    public ApiResponse<List<TeamJoinRequestDto>> listMyJoinRequests() {
        return ApiResponse.ok(teamService.listMyJoinRequests());
    }

    @GetMapping("/{teamId}/members")
    public ApiResponse<List<TeamMemberDto>> listTeamMembers(@PathVariable String teamId) {
        return ApiResponse.ok(teamService.listMembers(teamId));
    }

    @PutMapping("/{teamId}/members/{userId}/role")
    public ApiResponse<TeamMemberDto> updateMemberRole(
            @PathVariable String teamId,
            @PathVariable Long userId,
            @RequestBody UpdateTeamMemberRoleRequest request
    ) {
        return ApiResponse.ok(teamService.updateMemberRole(teamId, userId, request));
    }

    @GetMapping("/{teamId}/invites")
    public ApiResponse<List<TeamInviteDto>> listTeamInvites(@PathVariable String teamId) {
        return ApiResponse.ok(teamService.listPendingInvites(teamId));
    }

    @PostMapping("/{teamId}/invites/{inviteId}/approve")
    public ApiResponse<TeamSummaryDto> approveInvite(
            @PathVariable String teamId,
            @PathVariable String inviteId
    ) {
        return ApiResponse.ok(teamService.approveInvite(teamId, inviteId));
    }

    @PostMapping("/{teamId}/invites/{inviteId}/reject")
    public ApiResponse<TeamSummaryDto> rejectInvite(
            @PathVariable String teamId,
            @PathVariable String inviteId
    ) {
        return ApiResponse.ok(teamService.rejectInvite(teamId, inviteId));
    }

    @PutMapping("/{teamId}/settings")
    public ApiResponse<TeamSummaryDto> updateTeamSettings(
            @PathVariable String teamId,
            @RequestBody UpdateTeamSettingsRequest request
    ) {
        return ApiResponse.ok(teamService.updateTeamSettings(teamId, request));
    }

    @GetMapping("/{teamId}/audit-logs")
    public ApiResponse<List<TeamAuditLogDto>> listAuditLogs(
            @PathVariable String teamId,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(required = false) Long actorUserId,
            @RequestParam(required = false) String since,
            @RequestParam(required = false) String until
    ) {
        return ApiResponse.ok(teamService.listAuditLogs(
                teamId,
                limit,
                actorUserId,
                parseAuditInstant(since),
                parseAuditInstant(until)
        ));
    }

    private static java.time.Instant parseAuditInstant(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return java.time.Instant.parse(value.trim());
    }

    @PutMapping("/{teamId}/shared-connections")
    public ApiResponse<TeamSummaryDto> updateSharedConnections(
            @PathVariable String teamId,
            @RequestBody UpdateSharedConnectionsRequest request
    ) {
        return ApiResponse.ok(teamService.updateSharedConnections(
                teamId,
                request.connectionIds(),
                request.connectionAccess()
        ));
    }

    @PutMapping("/{teamId}/shared-consoles")
    public ApiResponse<TeamSummaryDto> updateSharedConsoles(
            @PathVariable String teamId,
            @RequestBody UpdateSharedConsolesRequest request
    ) {
        return ApiResponse.ok(teamService.updateSharedConsoles(teamId, request.consoleIds()));
    }

    @PutMapping("/{teamId}/share-sql-history")
    public ApiResponse<TeamSummaryDto> updateShareSqlHistory(
            @PathVariable String teamId,
            @RequestBody UpdateShareSqlHistoryRequest request
    ) {
        return ApiResponse.ok(teamService.updateShareSqlHistory(teamId, request.enabled()));
    }

    @PutMapping("/{teamId}/on-call-connections")
    public ApiResponse<TeamSummaryDto> updateOnCallConnections(
            @PathVariable String teamId,
            @RequestBody UpdateOnCallConnectionsRequest request
    ) {
        return ApiResponse.ok(teamService.updateOnCallConnections(teamId, request));
    }

    @GetMapping("/{teamId}/ai-sessions")
    public ApiResponse<List<TeamSharedAiSessionDto>> listSharedAiSessions(@PathVariable String teamId) {
        return ApiResponse.ok(teamService.listSharedAiSessions(teamId));
    }

    @GetMapping("/{teamId}/ai-sessions/{sessionId}")
    public ApiResponse<TeamSharedAiSessionDetailDto> getSharedAiSession(
            @PathVariable String teamId,
            @PathVariable String sessionId
    ) {
        return ApiResponse.ok(teamService.getSharedAiSession(teamId, sessionId));
    }

    @PostMapping("/{teamId}/ai-sessions")
    public ApiResponse<TeamSharedAiSessionDto> shareAiSession(
            @PathVariable String teamId,
            @RequestBody ShareTeamAiSessionRequest request
    ) {
        return ApiResponse.ok(teamService.shareAiSession(teamId, request));
    }

    @GetMapping("/{teamId}/shared-queries")
    public ApiResponse<List<TeamSharedQuerySummaryDto>> listSharedQueries(@PathVariable String teamId) {
        return ApiResponse.ok(teamService.listSharedQueries(teamId));
    }

    @GetMapping("/{teamId}/shared-queries/{queryId}")
    public ApiResponse<TeamSharedQueryDetailDto> getSharedQuery(
            @PathVariable String teamId,
            @PathVariable String queryId
    ) {
        return ApiResponse.ok(teamService.getSharedQuery(teamId, queryId));
    }

    @GetMapping(value = "/{teamId}/shared-queries/{queryId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamSharedQuery(
            @PathVariable String teamId,
            @PathVariable String queryId
    ) {
        return teamService.openSharedQueryStream(teamId, queryId);
    }

    @PostMapping("/{teamId}/shared-queries")
    public ApiResponse<TeamSharedQuerySummaryDto> shareQuery(
            @PathVariable String teamId,
            @RequestBody ShareTeamSharedQueryRequest request
    ) {
        return ApiResponse.ok(teamService.shareQuery(teamId, request));
    }

    @PutMapping("/{teamId}/shared-queries/{queryId}")
    public ApiResponse<TeamSharedQuerySummaryDto> updateSharedQuery(
            @PathVariable String teamId,
            @PathVariable String queryId,
            @RequestBody UpdateTeamSharedQueryRequest request
    ) {
        return ApiResponse.ok(teamService.updateSharedQuery(teamId, queryId, request));
    }

    @DeleteMapping("/{teamId}/shared-queries/{queryId}")
    public ApiResponse<Void> deleteSharedQuery(
            @PathVariable String teamId,
            @PathVariable String queryId
    ) {
        teamService.deleteSharedQuery(teamId, queryId);
        return ApiResponse.ok(null);
    }

    @PostMapping("/{teamId}/shared-queries/{queryId}/comments")
    public ApiResponse<TeamSharedQueryCommentDto> addSharedQueryComment(
            @PathVariable String teamId,
            @PathVariable String queryId,
            @RequestBody AddTeamSharedQueryCommentRequest request
    ) {
        return ApiResponse.ok(teamService.addSharedQueryComment(teamId, queryId, request));
    }

    @DeleteMapping("/{teamId}/shared-queries/{queryId}/comments/{commentId}")
    public ApiResponse<Void> deleteSharedQueryComment(
            @PathVariable String teamId,
            @PathVariable String queryId,
            @PathVariable String commentId
    ) {
        teamService.deleteSharedQueryComment(teamId, queryId, commentId);
        return ApiResponse.ok(null);
    }

    @PostMapping("/{teamId}/shared-queries/{queryId}/favorite")
    public ApiResponse<TeamSharedQuerySummaryDto> toggleSharedQueryFavorite(
            @PathVariable String teamId,
            @PathVariable String queryId
    ) {
        return ApiResponse.ok(teamService.toggleSharedQueryFavorite(teamId, queryId));
    }

    @GetMapping("/{teamId}/production-approvals")
    public ApiResponse<List<TeamProductionApprovalSummaryDto>> listProductionApprovals(
            @PathVariable String teamId,
            @RequestParam(required = false) String status
    ) {
        return ApiResponse.ok(teamService.listProductionApprovals(teamId, status));
    }

    @GetMapping("/{teamId}/production-approvals/{approvalId}")
    public ApiResponse<TeamProductionApprovalDetailDto> getProductionApproval(
            @PathVariable String teamId,
            @PathVariable String approvalId
    ) {
        return ApiResponse.ok(teamService.getProductionApproval(teamId, approvalId));
    }

    @PostMapping("/{teamId}/production-approvals")
    public ApiResponse<TeamProductionApprovalSummaryDto> submitProductionApproval(
            @PathVariable String teamId,
            @RequestBody SubmitTeamProductionApprovalRequest request
    ) {
        return ApiResponse.ok(teamService.submitProductionApproval(teamId, request));
    }

    @PostMapping("/{teamId}/production-approvals/{approvalId}/approve")
    public ApiResponse<TeamProductionApprovalDetailDto> approveProductionApproval(
            @PathVariable String teamId,
            @PathVariable String approvalId
    ) {
        return ApiResponse.ok(productionApprovalService.approveAndExecute(teamId, approvalId));
    }

    @PostMapping("/{teamId}/production-approvals/{approvalId}/reject")
    public ApiResponse<TeamProductionApprovalDetailDto> rejectProductionApproval(
            @PathVariable String teamId,
            @PathVariable String approvalId,
            @RequestBody(required = false) RejectTeamProductionApprovalRequest request
    ) {
        return ApiResponse.ok(teamService.rejectProductionApproval(teamId, approvalId, request));
    }
}
