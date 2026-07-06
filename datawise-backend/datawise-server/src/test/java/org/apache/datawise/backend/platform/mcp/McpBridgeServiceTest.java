package org.apache.datawise.backend.platform.mcp;

import org.apache.datawise.backend.ai.tag.AiTableTagService;
import org.apache.datawise.backend.database.drift.SchemaDriftService;
import org.apache.datawise.backend.platform.sql.SqlReviewOrchestrator;
import org.apache.datawise.backend.database.sql.SqlService;
import org.apache.datawise.backend.database.table.TableDetailService;
import org.apache.datawise.backend.domain.ExecuteSqlRequest;
import org.apache.datawise.backend.security.ApiTokenScopes;
import org.apache.datawise.backend.security.HeadlessMigrationAuth;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.service.ConnectionVisibilityService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class McpBridgeServiceTest {

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void executeReadonlyRejectsApiTokenWithoutSqlScope() {
        SqlService sqlService = mock(SqlService.class);
        McpBridgeService service = new McpBridgeService(
                mock(ConnectionVisibilityService.class),
                mock(TableDetailService.class),
                sqlService,
                mock(SqlReviewOrchestrator.class),
                mock(SchemaDriftService.class),
                mock(AiTableTagService.class),
                mock(org.apache.datawise.backend.ai.semantic.SemanticLayerService.class),
                mock(org.apache.datawise.backend.ai.canvas.AnalysisCanvasService.class),
                mock(org.apache.datawise.backend.ai.federated.FederatedSqlGeneratorService.class)
        );
        UserContext.setApiToken(1L, "tok-1", Set.of(ApiTokenScopes.MIGRATION));

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> service.executeReadonly(new ExecuteSqlRequest(
                        "select 1",
                        "conn-1",
                        "app",
                        100,
                        null,
                        null,
                        null,
                        "mcp"
                ))
        );

        assertEquals(HeadlessMigrationAuth.API_TOKEN_FORBIDDEN, error.getMessage());
        verifyNoInteractions(sqlService);
    }
}