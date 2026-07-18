package org.apache.datawise.backend.database.federated;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Best-effort in-memory evaluation of residual outer WHERE after federated JOIN.
 * Supports AND of simple comparisons, and OR within a conjunct
 * ({@code a.x = 1 OR b.y = 2}, optionally parenthesized).
 * Each atom is {@code alias.col OP literal} or {@code alias.col OP other.col}
 * where OP is {@code = != <> < <= > >=}.
 */
final class FederatedJoinResidualFilter {

    private FederatedJoinResidualFilter() {
    }

    static List<Map<String, Object>> apply(List<Map<String, Object>> rows, String residualWhere) {
        if (rows == null || rows.isEmpty() || residualWhere == null || residualWhere.isBlank()) {
            return rows;
        }
        List<String> conjuncts = FederatedJoinPredicatePushdown.splitAnd(residualWhere);
        return rows.stream()
                .filter(row -> conjuncts.stream().allMatch(c -> matchesConjunct(row, c)))
                .toList();
    }

    private static boolean matchesConjunct(Map<String, Object> row, String conjunct) {
        String unwrapped = unwrapOuterParens(conjunct);
        List<String> disjuncts = FederatedJoinPredicatePushdown.splitOr(unwrapped);
        if (disjuncts.size() > 1) {
            return disjuncts.stream().anyMatch(d -> matchesAtom(row, unwrapOuterParens(d)));
        }
        return matchesAtom(row, unwrapped);
    }

    private static boolean matchesAtom(Map<String, Object> row, String atom) {
        Comparison comparison = parseComparison(atom);
        if (comparison == null) {
            throw new IllegalArgumentException(
                    "Unsupported federated residual WHERE predicate (push single-alias filters into source "
                            + "subqueries or use simple comparisons / OR of comparisons): " + atom
            );
        }
        Object left = resolve(row, comparison.left());
        Object right = resolve(row, comparison.right());
        return compare(left, right, comparison.op());
    }

    /** Unwrap one or more layers of fully wrapping parentheses. */
    static String unwrapOuterParens(String expression) {
        if (expression == null) {
            return null;
        }
        String trimmed = expression.trim();
        while (trimmed.length() >= 2 && trimmed.charAt(0) == '(' && trimmed.charAt(trimmed.length() - 1) == ')') {
            if (!parensFullyWrap(trimmed)) {
                break;
            }
            trimmed = trimmed.substring(1, trimmed.length() - 1).trim();
        }
        return trimmed;
    }

    private static boolean parensFullyWrap(String text) {
        int depth = 0;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (ch == '(') {
                depth++;
            } else if (ch == ')') {
                depth--;
                if (depth == 0 && i < text.length() - 1) {
                    return false;
                }
                if (depth < 0) {
                    return false;
                }
            }
        }
        return depth == 0;
    }

    private static Comparison parseComparison(String conjunct) {
        if (conjunct == null || conjunct.isBlank()) {
            return null;
        }
        String trimmed = conjunct.trim();
        String[] ops = {"<>", "!=", "<=", ">=", "=", "<", ">"};
        for (String op : ops) {
            int idx = findOperator(trimmed, op);
            if (idx >= 0) {
                String left = trimmed.substring(0, idx).trim();
                String right = trimmed.substring(idx + op.length()).trim();
                if (!left.isEmpty() && !right.isEmpty()) {
                    return new Comparison(left, op, right);
                }
            }
        }
        return null;
    }

    private static int findOperator(String text, String op) {
        int depth = 0;
        boolean inSingle = false;
        boolean inDouble = false;
        for (int i = 0; i <= text.length() - op.length(); i++) {
            char ch = text.charAt(i);
            if (ch == '\'' && !inDouble) {
                inSingle = !inSingle;
            } else if (ch == '"' && !inSingle) {
                inDouble = !inDouble;
            } else if (!inSingle && !inDouble) {
                if (ch == '(') {
                    depth++;
                } else if (ch == ')') {
                    depth = Math.max(0, depth - 1);
                } else if (depth == 0 && text.regionMatches(i, op, 0, op.length())) {
                    return i;
                }
            }
        }
        return -1;
    }

    private static Object resolve(Map<String, Object> row, String token) {
        String trimmed = token.trim();
        if (isLiteral(trimmed)) {
            return literalValue(trimmed);
        }
        if (row.containsKey(trimmed)) {
            return row.get(trimmed);
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        for (Map.Entry<String, Object> entry : row.entrySet()) {
            if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(trimmed)) {
                return entry.getValue();
            }
            if (entry.getKey() != null && entry.getKey().toLowerCase(Locale.ROOT).equals(lower)) {
                return entry.getValue();
            }
        }
        return null;
    }

    private static boolean isLiteral(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        if ((token.startsWith("'") && token.endsWith("'"))
                || (token.startsWith("\"") && token.endsWith("\""))) {
            return true;
        }
        if ("null".equalsIgnoreCase(token) || "true".equalsIgnoreCase(token) || "false".equalsIgnoreCase(token)) {
            return true;
        }
        try {
            Double.parseDouble(token);
            return true;
        } catch (NumberFormatException ignored) {
            return false;
        }
    }

    private static Object literalValue(String token) {
        if ((token.startsWith("'") && token.endsWith("'"))
                || (token.startsWith("\"") && token.endsWith("\""))) {
            return token.substring(1, token.length() - 1);
        }
        if ("null".equalsIgnoreCase(token)) {
            return null;
        }
        if ("true".equalsIgnoreCase(token)) {
            return true;
        }
        if ("false".equalsIgnoreCase(token)) {
            return false;
        }
        try {
            if (token.contains(".")) {
                return Double.parseDouble(token);
            }
            return Long.parseLong(token);
        } catch (NumberFormatException ex) {
            return token;
        }
    }

    private static boolean compare(Object left, Object right, String op) {
        if ("=".equals(op)) {
            return eq(left, right);
        }
        if ("!=".equals(op) || "<>".equals(op)) {
            return !eq(left, right);
        }
        int cmp = compareValues(left, right);
        return switch (op) {
            case "<" -> cmp < 0;
            case "<=" -> cmp <= 0;
            case ">" -> cmp > 0;
            case ">=" -> cmp >= 0;
            default -> false;
        };
    }

    private static boolean eq(Object left, Object right) {
        if (left == null || right == null) {
            return left == right;
        }
        if (left instanceof Number && right instanceof Number) {
            return Double.compare(((Number) left).doubleValue(), ((Number) right).doubleValue()) == 0;
        }
        return String.valueOf(left).equals(String.valueOf(right));
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static int compareValues(Object left, Object right) {
        if (left == null || right == null) {
            throw new IllegalArgumentException("Cannot compare NULL in federated residual WHERE");
        }
        if (left instanceof Number && right instanceof Number) {
            return Double.compare(((Number) left).doubleValue(), ((Number) right).doubleValue());
        }
        if (left instanceof Comparable comparable && left.getClass().isInstance(right)) {
            return comparable.compareTo(right);
        }
        return String.valueOf(left).compareTo(String.valueOf(right));
    }

    private record Comparison(String left, String op, String right) {
    }
}
