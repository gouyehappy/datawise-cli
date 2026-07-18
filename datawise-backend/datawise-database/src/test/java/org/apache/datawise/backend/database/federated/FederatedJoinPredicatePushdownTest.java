package org.apache.datawise.backend.database.federated;

import org.apache.datawise.backend.database.federated.FederatedJoinSqlParser.FederatedJoinPlan;
import org.apache.datawise.backend.database.federated.FederatedJoinSqlParser.FederatedJoinStep;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FederatedJoinPredicatePushdownTest {

    @Test
    void pushesSingleAliasPredicatesAndKeepsCrossAliasResidual() {
        FederatedJoinPlan plan = new FederatedJoinPlan(
                List.of("o.id", "u.name"),
                List.of(
                        new FederatedJoinStep("orders", "o", "SELECT id, user_id, status FROM orders", null),
                        new FederatedJoinStep("users", "u", "SELECT id, name, region FROM users", "o.user_id = u.id")
                ),
                "o.status = 'active' AND u.region = 'CN' AND o.user_id = u.id"
        );

        FederatedJoinPredicatePushdown.PushdownResult result = FederatedJoinPredicatePushdown.apply(plan);

        assertNull(result.plan().outerWhere());
        assertTrue(result.plan().steps().get(0).subQuery().toUpperCase().contains("STATUS"));
        assertTrue(result.plan().steps().get(1).subQuery().toUpperCase().contains("REGION"));
        assertFalse(result.plan().steps().get(0).subQuery().contains("o."));
        assertEquals("o.user_id = u.id", result.residualWhere());
        assertTrue(result.pushedByTableAlias().containsKey("o"));
        assertTrue(result.pushedByTableAlias().containsKey("u"));
    }

    @Test
    void residualFilterAppliesCrossAliasEquality() {
        List<Map<String, Object>> rows = List.of(
                Map.of("o.id", 1, "o.user_id", 9, "u.id", 9, "u.name", "A"),
                Map.of("o.id", 2, "o.user_id", 8, "u.id", 9, "u.name", "B")
        );
        List<Map<String, Object>> filtered = FederatedJoinResidualFilter.apply(rows, "o.user_id = u.id");
        assertEquals(1, filtered.size());
        assertEquals(1, filtered.get(0).get("o.id"));
    }
}
