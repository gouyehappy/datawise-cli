package org.apache.datawise.backend.database.team;

import org.apache.datawise.backend.database.sql.SqlExecuteService;
import org.apache.datawise.backend.domain.ExecuteSqlRequest;
import org.apache.datawise.backend.domain.TeamProductionApprovalDetailDto;
import org.apache.datawise.backend.model.TeamProductionApprovalEntity;
import org.apache.datawise.backend.service.TeamService;
import org.springframework.stereotype.Service;

@Service
public class ProductionApprovalService {

    private final TeamService teamService;
    private final SqlExecuteService sqlExecuteService;

    public ProductionApprovalService(TeamService teamService, SqlExecuteService sqlExecuteService) {
        this.teamService = teamService;
        this.sqlExecuteService = sqlExecuteService;
    }

    public TeamProductionApprovalDetailDto approveAndExecute(String teamId, String approvalId) {
        TeamProductionApprovalEntity pending = teamService.requirePendingProductionApprovalForReview(teamId, approvalId);
        Long reviewerId = teamService.requireAuthenticatedUserId();
        try {
            sqlExecuteService.execute(new ExecuteSqlRequest(
                    pending.getSql(),
                    pending.getConnectionId(),
                    pending.getDatabase(),
                    null,
                    "prod-approval-" + pending.getId(),
                    null,
                    null,
                    null
            ));
            return teamService.finalizeProductionApproval(teamId, approvalId, reviewerId, true, null);
        } catch (Exception ex) {
            String message = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
            return teamService.finalizeProductionApproval(teamId, approvalId, reviewerId, false, message);
        }
    }
}
