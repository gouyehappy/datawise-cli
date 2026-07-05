import type {TeamApi} from '@/shared/api/types'
import type {
    JoinTeamResult,
    ShareTeamSharedQueryPayload,
    TeamAuditLog,
    TeamAuditLogQuery,
    TeamInvite,
    TeamJoinRequest,
    TeamMember,
    TeamSharedAiSessionDetail,
    TeamSharedAiSessionSummary,
    TeamSharedQueryComment,
    TeamSharedQueryDetail,
    TeamSharedQuerySummary,
    TeamProductionApprovalDetail,
    TeamProductionApprovalSummary,
    SubmitTeamProductionApprovalPayload,
    TeamSummary,
} from '@/core/types'
import {deleteJson, getJson, postJson, putJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

export function createHttpTeamApi(): TeamApi {
    return {
        fetchAll: () => getJson<TeamSummary[]>(API_PATHS.teams.list),

        create: (name) => postJson<TeamSummary>(API_PATHS.teams.create, {name}),

        join: (code) => postJson<JoinTeamResult>(API_PATHS.teams.join, {code}),

        fetchJoinRequests: () => getJson<TeamJoinRequest[]>(API_PATHS.teams.joinRequests),

        fetchMembers: (teamId) => getJson<TeamMember[]>(API_PATHS.teams.members(teamId)),

        updateMemberRole: (teamId, userId, role) =>
            putJson<TeamMember>(API_PATHS.teams.memberRole(teamId, userId), {role}),

        fetchInvites: (teamId) => getJson<TeamInvite[]>(API_PATHS.teams.invites(teamId)),

        approveInvite: (teamId, inviteId) =>
            postJson<TeamSummary>(API_PATHS.teams.approveInvite(teamId, inviteId), {}),

        rejectInvite: (teamId, inviteId) =>
            postJson<TeamSummary>(API_PATHS.teams.rejectInvite(teamId, inviteId), {}),

        updateSettings: (teamId, requireInviteApproval) =>
            putJson<TeamSummary>(API_PATHS.teams.settings(teamId), {requireInviteApproval}),

        fetchAuditLogs: (teamId, query) => {
            const params: Record<string, string | undefined> = {
                limit: query?.limit != null ? String(query.limit) : undefined,
                actorUserId: query?.actorUserId != null ? String(query.actorUserId) : undefined,
                since: query?.since,
                until: query?.until,
            }
            return getJson<TeamAuditLog[]>(API_PATHS.teams.auditLogs(teamId), params)
        },

        updateSharedConnections: (teamId, connectionIds, connectionAccess) =>
            putJson<TeamSummary>(API_PATHS.teams.sharedConnections(teamId), {
                connectionIds,
                connectionAccess,
            }),

        updateOnCallConnections: (teamId, connectionIds) =>
            putJson<TeamSummary>(API_PATHS.teams.onCallConnections(teamId), {connectionIds}),

        updateSharedConsoles: (teamId, consoleIds) =>
            putJson<TeamSummary>(API_PATHS.teams.sharedConsoles(teamId), {consoleIds}),

        updateShareSqlHistory: (teamId, enabled) =>
            putJson<TeamSummary>(API_PATHS.teams.shareSqlHistory(teamId), {enabled}),

        fetchSharedAiSessions: (teamId) =>
            getJson<TeamSharedAiSessionSummary[]>(API_PATHS.teams.aiSessions(teamId)),

        getSharedAiSession: (teamId, sessionId) =>
            getJson<TeamSharedAiSessionDetail>(API_PATHS.teams.aiSession(teamId, sessionId)),

        shareAiSession: (teamId, title, payloadJson) =>
            postJson<TeamSharedAiSessionSummary>(API_PATHS.teams.aiSessions(teamId), {title, payloadJson}),

        fetchSharedQueries: (teamId) =>
            getJson<TeamSharedQuerySummary[]>(API_PATHS.teams.sharedQueries(teamId)),

        getSharedQuery: (teamId, queryId) =>
            getJson<TeamSharedQueryDetail>(API_PATHS.teams.sharedQuery(teamId, queryId)),

        shareQuery: (teamId, payload) =>
            postJson<TeamSharedQuerySummary>(API_PATHS.teams.sharedQueries(teamId), payload),

        updateSharedQuery: (teamId, queryId, payload) =>
            putJson<TeamSharedQuerySummary>(API_PATHS.teams.sharedQuery(teamId, queryId), payload),

        deleteSharedQuery: (teamId, queryId) =>
            deleteJson<void>(API_PATHS.teams.sharedQuery(teamId, queryId)),

        addSharedQueryComment: (teamId, queryId, content) =>
            postJson<TeamSharedQueryComment>(
                API_PATHS.teams.sharedQueryComment(teamId, queryId),
                {content},
            ),

        deleteSharedQueryComment: (teamId, queryId, commentId) =>
            deleteJson<void>(API_PATHS.teams.sharedQueryCommentById(teamId, queryId, commentId)),

        toggleSharedQueryFavorite: (teamId, queryId) =>
            postJson<TeamSharedQuerySummary>(API_PATHS.teams.sharedQueryFavorite(teamId, queryId), {}),

        fetchProductionApprovals: (teamId, status) =>
            getJson<TeamProductionApprovalSummary[]>(API_PATHS.teams.productionApprovals(teamId), {
                status,
            }),

        getProductionApproval: (teamId, approvalId) =>
            getJson<TeamProductionApprovalDetail>(API_PATHS.teams.productionApproval(teamId, approvalId)),

        submitProductionApproval: (teamId, payload) =>
            postJson<TeamProductionApprovalSummary>(API_PATHS.teams.productionApprovals(teamId), payload),

        approveProductionApproval: (teamId, approvalId) =>
            postJson<TeamProductionApprovalDetail>(
                API_PATHS.teams.productionApprovalApprove(teamId, approvalId),
                {},
            ),

        rejectProductionApproval: (teamId, approvalId, comment) =>
            postJson<TeamProductionApprovalDetail>(
                API_PATHS.teams.productionApprovalReject(teamId, approvalId),
                {comment},
            ),
    }
}
