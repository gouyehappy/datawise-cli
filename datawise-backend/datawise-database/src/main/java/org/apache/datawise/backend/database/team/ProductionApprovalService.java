package org.apache.datawise.backend.database.team;

import org.apache.datawise.backend.database.sql.SqlExecuteService;
import org.apache.datawise.backend.domain.ExecuteSqlRequest;
import org.apache.datawise.backend.domain.TeamProductionApprovalDetailDto;
import org.apache.datawise.backend.model.TeamProductionApprovalEntity;
import org.apache.datawise.backend.service.TeamService;
import org.springframework.stereotype.Service;

@Service
public class ProductionApprovalService {

    /** Frontend embeds this marker in data-migration approval plans (not executable SQL). */
    public static final String DATA_MIGRATION_APPROVAL_MARKER = "DATAWISE_APPROVAL_KIND:DATA_MIGRATION";

    private final TeamService teamService;
    private final SqlExecuteService sqlExecuteService;

    public ProductionApprovalService(TeamService teamService, SqlExecuteService sqlExecuteService) {
        this.teamService = teamService;
        this.sqlExecuteService = sqlExecuteService;
    }

    public TeamProductionApprovalDetailDto approveAndExecute(String teamId, String approvalId) {
        TeamProductionApprovalEntity pending = teamService.requirePendingProductionApprovalForReview(teamId, approvalId);
        Long reviewerId = teamService.requireAuthenticatedUserId();
        if (isDataMigrationPlan(pending.getSql())) {
            return teamService.finalizeProductionApproval(teamId, approvalId, reviewerId, true, null);
        }
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

    static boolean isDataMigrationPlan(String sql) {
        return sql != null && sql.contains(DATA_MIGRATION_APPROVAL_MARKER);
    }
}
