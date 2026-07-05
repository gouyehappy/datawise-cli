package org.apache.datawise.backend.sync.job;

import org.apache.datawise.backend.domain.TablePropertiesResult;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.connector.facade.ConnectorFacade;
import org.springframework.stereotype.Service;

import java.sql.SQLException;

/** 迁移预检行数估算（失败时返回 null，不阻断预检）。 */
@Service
public class MigrationRowCountEstimator {

    private final ConnectorFacade connectorFacade;

    public MigrationRowCountEstimator(ConnectorFacade connectorFacade) {
        this.connectorFacade = connectorFacade;
    }

    public Long countRowsSafe(
            ConnectionEntity entity,
            String database,
            String tableName,
            String whereClause
    ) {
        try {
            return connectorFacade.jdbc().countTableRows(entity, tableName, database, whereClause);
        } catch (SQLException ex) {
            return null;
        }
    }
}
