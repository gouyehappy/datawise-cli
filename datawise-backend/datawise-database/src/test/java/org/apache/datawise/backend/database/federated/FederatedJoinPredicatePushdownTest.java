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

    @Test
    void residualFilterSupportsTopLevelOrAcrossAliases() {
        List<Map<String, Object>> rows = List.of(
                Map.of("o.id", 1, "o.status", "active", "u.region", "US"),
                Map.of("o.id", 2, "o.status", "closed", "u.region", "CN"),
                Map.of("o.id", 3, "o.status", "closed", "u.region", "US")
        );
        List<Map<String, Object>> filtered = FederatedJoinResidualFilter.apply(
                rows,
                "o.status = 'active' OR u.region = 'CN'"
        );
        assertEquals(2, filtered.size());
        assertEquals(1, filtered.get(0).get("o.id"));
        assertEquals(2, filtered.get(1).get("o.id"));
    }

    @Test
    void residualFilterSupportsParenthesizedOrAndedWithComparison() {
        List<Map<String, Object>> rows = List.of(
                Map.of("o.id", 1, "o.status", "active", "u.region", "US", "o.user_id", 9, "u.id", 9),
                Map.of("o.id", 2, "o.status", "closed", "u.region", "CN", "o.user_id", 8, "u.id", 9),
                Map.of("o.id", 3, "o.status", "active", "u.region", "CN", "o.user_id", 7, "u.id", 7)
        );
        List<Map<String, Object>> filtered = FederatedJoinResidualFilter.apply(
                rows,
                "(o.status = 'active' OR u.region = 'CN') AND o.user_id = u.id"
        );
        assertEquals(2, filtered.size());
        assertEquals(1, filtered.get(0).get("o.id"));
        assertEquals(3, filtered.get(1).get("o.id"));
    }

    @Test
    void crossAliasOrRemainsResidualAfterPushdown() {
        FederatedJoinPlan plan = new FederatedJoinPlan(
                List.of("o.id", "u.name"),
                List.of(
                        new FederatedJoinStep("orders", "o", "SELECT id, user_id, status FROM orders", null),
                        new FederatedJoinStep("users", "u", "SELECT id, name, region FROM users", "o.user_id = u.id")
                ),
                "o.amount > 0 AND (o.status = 'active' OR u.region = 'CN')"
        );

        FederatedJoinPredicatePushdown.PushdownResult result = FederatedJoinPredicatePushdown.apply(plan);

        assertTrue(result.plan().steps().get(0).subQuery().toUpperCase().contains("AMOUNT"));
        assertEquals("(o.status = 'active' OR u.region = 'CN')", result.residualWhere());
    }

    @Test
    void splitOrIsParenAware() {
        assertEquals(
                List.of("o.status = 'active'", "u.region = 'CN'"),
                FederatedJoinPredicatePushdown.splitOr("o.status = 'active' OR u.region = 'CN'")
        );
        assertEquals(
                List.of("(o.status = 'active' OR u.region = 'CN')"),
                FederatedJoinPredicatePushdown.splitOr("(o.status = 'active' OR u.region = 'CN')")
        );
    }

    @Test
    void residualFilterSupportsInAndNotIn() {
        List<Map<String, Object>> rows = List.of(
                Map.of("o.id", 1, "o.status", "active", "u.region", "US"),
                Map.of("o.id", 2, "o.status", "pending", "u.region", "CN"),
                Map.of("o.id", 3, "o.status", "closed", "u.region", "US")
        );
        List<Map<String, Object>> inFiltered = FederatedJoinResidualFilter.apply(
                rows,
                "o.status IN ('active', 'pending')"
        );
        assertEquals(2, inFiltered.size());
        assertEquals(1, inFiltered.get(0).get("o.id"));
        assertEquals(2, inFiltered.get(1).get("o.id"));

        List<Map<String, Object>> notInFiltered = FederatedJoinResidualFilter.apply(
                rows,
                "o.status NOT IN ('closed')"
        );
        assertEquals(2, notInFiltered.size());
    }

    @Test
    void residualFilterSupportsInCombinedWithOr() {
        List<Map<String, Object>> rows = List.of(
                Map.of("o.id", 1, "o.status", "closed", "u.region", "US"),
                Map.of("o.id", 2, "o.status", "closed", "u.region", "CN"),
                Map.of("o.id", 3, "o.status", "active", "u.region", "US")
        );
        List<Map<String, Object>> filtered = FederatedJoinResidualFilter.apply(
                rows,
                "o.status IN ('active') OR u.region = 'CN'"
        );
        assertEquals(2, filtered.size());
        assertEquals(2, filtered.get(0).get("o.id"));
        assertEquals(3, filtered.get(1).get("o.id"));
    }

    @Test
    void residualFilterSupportsBareNot() {
        List<Map<String, Object>> rows = List.of(
                Map.of("o.id", 1, "o.status", "active", "u.region", "US"),
                Map.of("o.id", 2, "o.status", "closed", "u.region", "CN"),
                Map.of("o.id", 3, "o.status", "closed", "u.region", "US")
        );
        List<Map<String, Object>> filtered = FederatedJoinResidualFilter.apply(
                rows,
                "NOT o.status = 'closed'"
        );
        assertEquals(1, filtered.size());
        assertEquals(1, filtered.get(0).get("o.id"));
    }

    @Test
    void residualFilterSupportsBareNotOverOrGroup() {
        List<Map<String, Object>> rows = List.of(
                Map.of("o.id", 1, "o.status", "active", "u.region", "US"),
                Map.of("o.id", 2, "o.status", "closed", "u.region", "CN"),
                Map.of("o.id", 3, "o.status", "closed", "u.region", "US")
        );
        // Negate (active OR CN) → keep only closed+US
        List<Map<String, Object>> filtered = FederatedJoinResidualFilter.apply(
                rows,
                "NOT (o.status = 'active' OR u.region = 'CN')"
        );
        assertEquals(1, filtered.size());
        assertEquals(3, filtered.get(0).get("o.id"));
    }

    @Test
    void singleAliasOrIsPushedIntoSourceSubquery() {
        FederatedJoinPlan plan = new FederatedJoinPlan(
                List.of("o.id", "u.name"),
                List.of(
                        new FederatedJoinStep("orders", "o", "SELECT id, user_id, status FROM orders", null),
                        new FederatedJoinStep("users", "u", "SELECT id, name, region FROM users", "o.user_id = u.id")
                ),
                "o.status = 'active' OR o.status = 'pending'"
        );

        FederatedJoinPredicatePushdown.PushdownResult result = FederatedJoinPredicatePushdown.apply(plan);

        String ordersSql = result.plan().steps().get(0).subQuery().toUpperCase();
        assertTrue(ordersSql.contains("STATUS"));
        assertTrue(ordersSql.contains(" OR "));
        assertTrue(ordersSql.contains("ACTIVE"));
        assertTrue(ordersSql.contains("PENDING"));
        assertFalse(result.plan().steps().get(0).subQuery().contains("o."));
        assertNull(result.residualWhere());
    }

    @Test
    void singleAliasIsNullIsPushedIntoSourceSubquery() {
        FederatedJoinPlan plan = new FederatedJoinPlan(
                List.of("o.id", "u.name"),
                List.of(
                        new FederatedJoinStep("orders", "o", "SELECT id, user_id, deleted_at FROM orders", null),
                        new FederatedJoinStep("users", "u", "SELECT id, name FROM users", "o.user_id = u.id")
                ),
                "o.deleted_at IS NULL AND u.name IS NOT NULL"
        );

        FederatedJoinPredicatePushdown.PushdownResult result = FederatedJoinPredicatePushdown.apply(plan);

        assertTrue(result.plan().steps().get(0).subQuery().toUpperCase().contains("IS NULL"));
        assertTrue(result.plan().steps().get(1).subQuery().toUpperCase().contains("IS NOT NULL"));
        assertNull(result.residualWhere());
    }

    @Test
    void residualFilterSupportsIsNullAcrossAliases() {
        Map<String, Object> withNull = new java.util.HashMap<>();
        withNull.put("o.id", 1);
        withNull.put("o.deleted_at", null);
        withNull.put("u.region", "CN");
        Map<String, Object> withValue = Map.of("o.id", 2, "o.deleted_at", "2026-01-01", "u.region", "US");
        List<Map<String, Object>> filtered = FederatedJoinResidualFilter.apply(
                List.of(withNull, withValue),
                "o.deleted_at IS NULL OR u.region = 'US'"
        );
        assertEquals(2, filtered.size());

        List<Map<String, Object>> onlyNull = FederatedJoinResidualFilter.apply(
                List.of(withNull, withValue),
                "o.deleted_at IS NULL"
        );
        assertEquals(1, onlyNull.size());
        assertEquals(1, onlyNull.get(0).get("o.id"));

        List<Map<String, Object>> notNull = FederatedJoinResidualFilter.apply(
                List.of(withNull, withValue),
                "o.deleted_at IS NOT NULL"
        );
        assertEquals(1, notNull.size());
        assertEquals(2, notNull.get(0).get("o.id"));
    }

    @Test
    void residualFilterSupportsLikeAndNotLike() {
        List<Map<String, Object>> rows = List.of(
                Map.of("o.id", 1, "o.name", "alpha", "u.region", "CN"),
                Map.of("o.id", 2, "o.name", "beta", "u.region", "US"),
                Map.of("o.id", 3, "o.name", "alpine", "u.region", "CN")
        );
        List<Map<String, Object>> like = FederatedJoinResidualFilter.apply(rows, "o.name LIKE 'al%'");
        assertEquals(2, like.size());
        assertEquals(1, like.get(0).get("o.id"));
        assertEquals(3, like.get(1).get("o.id"));

        List<Map<String, Object>> notLike = FederatedJoinResidualFilter.apply(rows, "o.name NOT LIKE 'al%'");
        assertEquals(1, notLike.size());
        assertEquals(2, notLike.get(0).get("o.id"));

        List<Map<String, Object>> mixed = FederatedJoinResidualFilter.apply(
                rows,
                "o.name LIKE 'a_p%' OR u.region = 'US'"
        );
        assertEquals(3, mixed.size());
    }

    @Test
    void singleAliasLikeIsPushedIntoSourceSubquery() {
        FederatedJoinPlan plan = new FederatedJoinPlan(
                List.of("o.id", "u.name"),
                List.of(
                        new FederatedJoinStep("orders", "o", "SELECT id, user_id, name FROM orders", null),
                        new FederatedJoinStep("users", "u", "SELECT id, name, region FROM users", "o.user_id = u.id")
                ),
                "o.name LIKE 'acme%' AND u.region = 'CN'"
        );

        FederatedJoinPredicatePushdown.PushdownResult result = FederatedJoinPredicatePushdown.apply(plan);

        String ordersSql = result.plan().steps().get(0).subQuery().toUpperCase();
        assertTrue(ordersSql.contains("LIKE"));
        assertTrue(ordersSql.contains("ACME%"));
        assertTrue(result.plan().steps().get(1).subQuery().toUpperCase().contains("REGION"));
        assertNull(result.residualWhere());
    }

    @Test
    void likePatternToRegexEscapesRegexMetacharacters() {
        assertTrue(FederatedJoinResidualFilter.likeMatches("a.b", "a.b"));
        assertFalse(FederatedJoinResidualFilter.likeMatches("axb", "a.b"));
        assertTrue(FederatedJoinResidualFilter.likeMatches("axb", "a_b"));
        assertTrue(FederatedJoinResidualFilter.likeMatches("hello", "%ell%"));
    }

    @Test
    void singleAliasNotIsPushedIntoSourceSubquery() {
        FederatedJoinPlan plan = new FederatedJoinPlan(
                List.of("o.id", "u.name"),
                List.of(
                        new FederatedJoinStep("orders", "o", "SELECT id, user_id, status FROM orders", null),
                        new FederatedJoinStep("users", "u", "SELECT id, name, region FROM users", "o.user_id = u.id")
                ),
                "NOT o.status = 'closed' AND u.region = 'CN'"
        );

        FederatedJoinPredicatePushdown.PushdownResult result = FederatedJoinPredicatePushdown.apply(plan);

        String ordersSql = result.plan().steps().get(0).subQuery().toUpperCase();
        assertTrue(ordersSql.contains("NOT"));
        assertTrue(ordersSql.contains("STATUS"));
        assertTrue(result.plan().steps().get(1).subQuery().toUpperCase().contains("REGION"));
        assertNull(result.residualWhere());
    }
}
