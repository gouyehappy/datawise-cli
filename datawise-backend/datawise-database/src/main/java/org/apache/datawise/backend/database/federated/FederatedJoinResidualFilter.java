package org.apache.datawise.backend.database.federated;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Best-effort in-memory evaluation of residual outer WHERE after federated JOIN.
 * Supports AND of atoms, OR within a conjunct, and bare {@code NOT} over a supported
 * atom or parenthesized group
 * ({@code NOT o.status = 'closed'}, {@code NOT (o.a = 1 OR u.b = 2)}).
 * Each atom is a simple comparison ({@code = != <> < <= > >=}),
 * {@code alias.col IS [NOT] NULL},
 * {@code alias.col [NOT] LIKE 'pattern'},
 * expression functions ({@code UPPER}/{@code LOWER}/{@code TRIM}/{@code LTRIM}/{@code RTRIM}/
 * {@code LENGTH}/{@code CHAR_LENGTH}/{@code ABS}/{@code ROUND}/{@code CEIL}/{@code FLOOR}/
 * {@code GREATEST}/{@code LEAST}/{@code COALESCE}/{@code NULLIF}/
 * {@code CONCAT}/{@code SUBSTR}/{@code SUBSTRING}/{@code ||}/{@code CAST(expr AS type)}/
 * {@code CASE WHEN … THEN … ELSE … END} (prefer parenthesized CASE in comparisons)} in
 * comparisons / LIKE / BETWEEN,
 * {@code alias.col [NOT] BETWEEN low AND high},
 * or {@code alias.col IN (...)} / {@code NOT IN (...)} with literal list values.
 */
final class FederatedJoinResidualFilter {

    private static final Set<String> SUPPORTED_FUNCTIONS = Set.of(
            "upper", "lower", "trim", "ltrim", "rtrim",
            "length", "char_length", "abs", "round", "ceil", "ceiling", "floor",
            "greatest", "least",
            "coalesce", "nullif", "concat", "substr", "substring"
    );

    private static final Set<String> CAST_STRING_TYPES = Set.of(
            "varchar", "char", "character", "text", "string", "nvarchar", "nchar"
    );
    private static final Set<String> CAST_INT_TYPES = Set.of(
            "int", "integer", "bigint", "smallint", "tinyint", "long"
    );
    private static final Set<String> CAST_FLOAT_TYPES = Set.of(
            "double", "float", "real", "decimal", "numeric", "number"
    );
    private static final Set<String> CAST_BOOL_TYPES = Set.of("boolean", "bool");

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
        String notInner = stripLeadingNot(atom);
        if (notInner != null) {
            return !matchesConjunct(row, notInner);
        }
        NullCheck nullCheck = parseNullCheck(atom);
        if (nullCheck != null) {
            Object value = resolve(row, nullCheck.column());
            boolean isNull = value == null;
            return nullCheck.negated() != isNull;
        }
        InPredicate inPredicate = parseInPredicate(atom);
        if (inPredicate != null) {
            Object value = resolve(row, inPredicate.left());
            boolean contained = false;
            for (Object candidate : inPredicate.values()) {
                if (eq(value, candidate)) {
                    contained = true;
                    break;
                }
            }
            return inPredicate.negated() != contained;
        }
        LikePredicate likePredicate = parseLikePredicate(atom);
        if (likePredicate != null) {
            Object value = resolve(row, likePredicate.left());
            boolean matched = likeMatches(value, likePredicate.pattern(), likePredicate.escape());
            return likePredicate.negated() != matched;
        }
        BetweenPredicate betweenPredicate = parseBetweenPredicate(atom);
        if (betweenPredicate != null) {
            Object value = resolve(row, betweenPredicate.left());
            Object low = resolve(row, betweenPredicate.low());
            Object high = resolve(row, betweenPredicate.high());
            return betweenMatches(value, low, high, betweenPredicate.negated());
        }
        Comparison comparison = parseComparison(atom);
        if (comparison == null) {
            throw new IllegalArgumentException(
                    "Unsupported federated residual WHERE predicate (push single-alias filters into source "
                            + "subqueries or use simple comparisons / IS NULL / LIKE / BETWEEN / "
                            + "LENGTH|ABS|ROUND|CEIL|FLOOR|GREATEST|LEAST|COALESCE|CONCAT|SUBSTR / UPPER|LOWER|TRIM / CAST / CASE / IN / NOT / OR "
                            + "of those): "
                            + atom
            );
        }
        Object left = resolve(row, comparison.left());
        Object right = resolve(row, comparison.right());
        return compare(left, right, comparison.op());
    }

    /**
     * Parse {@code left [NOT] LIKE 'pattern' [ESCAPE 'x']}. Pattern (and escape) must be
     * string literals. Returns null when the atom is not a LIKE form.
     */
    static LikePredicate parseLikePredicate(String atom) {
        if (atom == null || atom.isBlank()) {
            return null;
        }
        String trimmed = atom.trim();
        int notLikeIdx = findKeyword(trimmed, "not like", 8);
        int likeIdx = findKeyword(trimmed, "like", 4);
        boolean negated;
        int keywordStart;
        int keywordLen;
        if (notLikeIdx >= 0) {
            negated = true;
            keywordStart = notLikeIdx;
            keywordLen = 8;
        } else if (likeIdx >= 0) {
            negated = false;
            keywordStart = likeIdx;
            keywordLen = 4;
        } else {
            return null;
        }
        String left = trimmed.substring(0, keywordStart).trim();
        String afterLike = trimmed.substring(keywordStart + keywordLen).trim();
        if (left.isEmpty() || afterLike.isEmpty()) {
            return null;
        }
        StringLiteralTake patternLit = takeLeadingStringLiteral(afterLike);
        if (patternLit == null) {
            return null;
        }
        String rest = patternLit.remainder().trim();
        Character escape = null;
        if (!rest.isEmpty()) {
            if (findKeyword(rest, "escape", 6) != 0) {
                return null;
            }
            String afterEscape = rest.substring(6).trim();
            StringLiteralTake escapeLit = takeLeadingStringLiteral(afterEscape);
            if (escapeLit == null || !escapeLit.remainder().trim().isEmpty()) {
                return null;
            }
            if (escapeLit.value().length() != 1) {
                throw new IllegalArgumentException(
                        "Federated residual LIKE ESCAPE must be a single character: " + atom
                );
            }
            escape = escapeLit.value().charAt(0);
        }
        return new LikePredicate(left, negated, patternLit.value(), escape);
    }

    /**
     * Parse {@code left [NOT] BETWEEN low AND high}. Bounds may be literals, columns, or
     * supported unary string functions. Returns null when the atom is not a BETWEEN form.
     */
    static BetweenPredicate parseBetweenPredicate(String atom) {
        if (atom == null || atom.isBlank()) {
            return null;
        }
        String trimmed = atom.trim();
        int notBetweenIdx = findKeyword(trimmed, "not between", 11);
        int betweenIdx = findKeyword(trimmed, "between", 7);
        boolean negated;
        int keywordStart;
        int keywordLen;
        if (notBetweenIdx >= 0) {
            negated = true;
            keywordStart = notBetweenIdx;
            keywordLen = 11;
        } else if (betweenIdx >= 0) {
            negated = false;
            keywordStart = betweenIdx;
            keywordLen = 7;
        } else {
            return null;
        }
        String left = trimmed.substring(0, keywordStart).trim();
        String afterBetween = trimmed.substring(keywordStart + keywordLen).trim();
        if (left.isEmpty() || afterBetween.isEmpty()) {
            return null;
        }
        int andIdx = findKeyword(afterBetween, "and", 3);
        if (andIdx < 0) {
            return null;
        }
        String low = afterBetween.substring(0, andIdx).trim();
        String high = afterBetween.substring(andIdx + 3).trim();
        if (low.isEmpty() || high.isEmpty()) {
            return null;
        }
        return new BetweenPredicate(left, negated, low, high);
    }

    /**
     * Inclusive BETWEEN. Any NULL operand yields false (three-valued SQL unknown → filter out).
     */
    static boolean betweenMatches(Object value, Object low, Object high, boolean negated) {
        if (value == null || low == null || high == null) {
            return false;
        }
        boolean inRange = compareValues(value, low) >= 0 && compareValues(value, high) <= 0;
        return negated != inRange;
    }

    static boolean likeMatches(Object value, String pattern) {
        return likeMatches(value, pattern, null);
    }

    static boolean likeMatches(Object value, String pattern, Character escape) {
        if (value == null || pattern == null) {
            return false;
        }
        return toLikeRegex(pattern, escape).matcher(String.valueOf(value)).matches();
    }

    /** Convert SQL LIKE pattern ({@code %} / {@code _}, optional ESCAPE) to a full-match regex. */
    static java.util.regex.Pattern toLikeRegex(String pattern) {
        return toLikeRegex(pattern, null);
    }

    static java.util.regex.Pattern toLikeRegex(String pattern, Character escape) {
        StringBuilder regex = new StringBuilder("^");
        for (int i = 0; i < pattern.length(); i++) {
            char ch = pattern.charAt(i);
            if (escape != null && ch == escape) {
                if (i + 1 >= pattern.length()) {
                    appendRegexLiteral(regex, ch);
                    continue;
                }
                appendRegexLiteral(regex, pattern.charAt(++i));
                continue;
            }
            if (ch == '%') {
                regex.append(".*");
            } else if (ch == '_') {
                regex.append('.');
            } else {
                appendRegexLiteral(regex, ch);
            }
        }
        regex.append('$');
        return java.util.regex.Pattern.compile(regex.toString(), java.util.regex.Pattern.DOTALL);
    }

    private static void appendRegexLiteral(StringBuilder regex, char ch) {
        if ("\\.[]{}()*+-?^$|".indexOf(ch) >= 0) {
            regex.append('\\');
        }
        regex.append(ch);
    }

    /** Consume a leading SQL string literal; return value + remainder, or null. */
    static StringLiteralTake takeLeadingStringLiteral(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String trimmed = text.trim();
        char quote = trimmed.charAt(0);
        if (quote != '\'' && quote != '"') {
            return null;
        }
        StringBuilder body = new StringBuilder();
        for (int i = 1; i < trimmed.length(); i++) {
            char ch = trimmed.charAt(i);
            if (ch == quote) {
                if (i + 1 < trimmed.length() && trimmed.charAt(i + 1) == quote) {
                    body.append(quote);
                    i++;
                    continue;
                }
                return new StringLiteralTake(body.toString(), trimmed.substring(i + 1));
            }
            body.append(ch);
        }
        return null;
    }

    /**
     * Parse {@code left IS [NOT] NULL}. Returns null when the atom is not a null-check form.
     */
    static NullCheck parseNullCheck(String atom) {
        if (atom == null || atom.isBlank()) {
            return null;
        }
        String trimmed = atom.trim();
        int notNullIdx = findKeyword(trimmed, "is not null", 11);
        if (notNullIdx >= 0) {
            String left = trimmed.substring(0, notNullIdx).trim();
            String rest = trimmed.substring(notNullIdx + 11).trim();
            if (!left.isEmpty() && rest.isEmpty()) {
                return new NullCheck(left, true);
            }
            return null;
        }
        int nullIdx = findKeyword(trimmed, "is null", 7);
        if (nullIdx >= 0) {
            String left = trimmed.substring(0, nullIdx).trim();
            String rest = trimmed.substring(nullIdx + 7).trim();
            if (!left.isEmpty() && rest.isEmpty()) {
                return new NullCheck(left, false);
            }
        }
        return null;
    }

    /**
     * Strip a leading bare {@code NOT} (not {@code NOT IN}). Returns the remainder, or null
     * when the atom is not a bare-NOT form.
     */
    static String stripLeadingNot(String atom) {
        if (atom == null || atom.isBlank()) {
            return null;
        }
        String trimmed = atom.trim();
        // Keep "NOT IN (...)" / "NOT BETWEEN" for dedicated parsers.
        if (findKeyword(trimmed, "not in", 6) == 0
                || findKeyword(trimmed, "not between", 11) == 0) {
            return null;
        }
        if (findKeyword(trimmed, "not", 3) != 0) {
            return null;
        }
        String rest = trimmed.substring(3).trim();
        return rest.isEmpty() ? null : rest;
    }

    /**
     * Parse {@code left [NOT] IN (lit, …)}. Returns null when the atom is not an IN form;
     * throws when it looks like IN but the list is not all literals.
     */
    static InPredicate parseInPredicate(String atom) {
        if (atom == null || atom.isBlank()) {
            return null;
        }
        String trimmed = atom.trim();
        int notInIdx = findKeyword(trimmed, "not in", 6);
        int inIdx = findKeyword(trimmed, "in", 2);
        boolean negated;
        int keywordStart;
        int keywordLen;
        if (notInIdx >= 0) {
            negated = true;
            keywordStart = notInIdx;
            keywordLen = 6;
        } else if (inIdx >= 0) {
            negated = false;
            keywordStart = inIdx;
            keywordLen = 2;
        } else {
            return null;
        }
        String left = trimmed.substring(0, keywordStart).trim();
        String rest = trimmed.substring(keywordStart + keywordLen).trim();
        if (left.isEmpty() || !rest.startsWith("(") || !rest.endsWith(")") || !parensFullyWrap(rest)) {
            return null;
        }
        String listBody = rest.substring(1, rest.length() - 1).trim();
        List<Object> values = parseLiteralList(listBody);
        if (values == null) {
            throw new IllegalArgumentException(
                    "Unsupported federated residual IN list (literals only): " + atom
            );
        }
        return new InPredicate(left, negated, values);
    }

    private static int findKeyword(String text, String keyword, int keywordLength) {
        int depth = 0;
        boolean inSingle = false;
        boolean inDouble = false;
        for (int i = 0; i <= text.length() - keywordLength; i++) {
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
                } else if (depth == 0 && text.regionMatches(true, i, keyword, 0, keywordLength)) {
                    boolean leftOk = i == 0 || !isIdentChar(text.charAt(i - 1));
                    boolean rightOk = i + keywordLength >= text.length()
                            || !isIdentChar(text.charAt(i + keywordLength));
                    if (leftOk && rightOk) {
                        return i;
                    }
                }
            }
        }
        return -1;
    }

    private static boolean isIdentChar(char ch) {
        return Character.isLetterOrDigit(ch) || ch == '_';
    }

    /** Comma-split literal list; null if any token is not a literal. */
    static List<Object> parseLiteralList(String listBody) {
        if (listBody == null || listBody.isBlank()) {
            return List.of();
        }
        List<Object> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inSingle = false;
        boolean inDouble = false;
        for (int i = 0; i < listBody.length(); i++) {
            char ch = listBody.charAt(i);
            if (ch == '\'' && !inDouble) {
                inSingle = !inSingle;
                current.append(ch);
            } else if (ch == '"' && !inSingle) {
                inDouble = !inDouble;
                current.append(ch);
            } else if (ch == ',' && !inSingle && !inDouble) {
                if (!addLiteralToken(values, current)) {
                    return null;
                }
                current = new StringBuilder();
            } else {
                current.append(ch);
            }
        }
        if (!addLiteralToken(values, current)) {
            return null;
        }
        return values;
    }

    private static boolean addLiteralToken(List<Object> values, StringBuilder current) {
        String token = current.toString().trim();
        if (token.isEmpty()) {
            return true;
        }
        if (!isLiteral(token)) {
            return false;
        }
        values.add(literalValue(token));
        return true;
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
        CaseExpr caseExpr = parseCase(trimmed);
        if (caseExpr != null) {
            return evaluateCase(row, caseExpr);
        }
        CastCall cast = parseCast(trimmed);
        if (cast != null) {
            return applyCast(resolve(row, cast.expression()), cast.targetType());
        }
        FunctionCall call = parseFunctionCall(trimmed);
        if (call != null) {
            return applyFunction(row, call);
        }
        int concatIdx = findOperator(trimmed, "||");
        if (concatIdx >= 0) {
            Object left = resolve(row, trimmed.substring(0, concatIdx).trim());
            Object right = resolve(row, trimmed.substring(concatIdx + 2).trim());
            return concatValues(left, right);
        }
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

    /**
     * Parse {@code CASE WHEN &lt;predicate&gt; THEN &lt;expr&gt; ELSE &lt;expr&gt; END}.
     * Nested CASE is not supported. Returns null when the token is not this form.
     */
    static CaseExpr parseCase(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        String trimmed = unwrapOuterParens(token.trim());
        if (trimmed.length() < 12 || !trimmed.regionMatches(true, 0, "case", 0, 4)) {
            return null;
        }
        int whenIdx = findKeyword(trimmed, "when", 4);
        int thenIdx = findKeyword(trimmed, "then", 4);
        int elseIdx = findKeyword(trimmed, "else", 4);
        int endIdx = findKeyword(trimmed, "end", 3);
        if (whenIdx < 0 || thenIdx < 0 || elseIdx < 0 || endIdx < 0) {
            return null;
        }
        if (!(whenIdx < thenIdx && thenIdx < elseIdx && elseIdx < endIdx)) {
            return null;
        }
        // Require trailing END (allow only whitespace after).
        String afterEnd = trimmed.substring(endIdx + 3).trim();
        if (!afterEnd.isEmpty()) {
            return null;
        }
        String predicate = trimmed.substring(whenIdx + 4, thenIdx).trim();
        String thenExpr = trimmed.substring(thenIdx + 4, elseIdx).trim();
        String elseExpr = trimmed.substring(elseIdx + 4, endIdx).trim();
        if (predicate.isEmpty() || thenExpr.isEmpty() || elseExpr.isEmpty()) {
            return null;
        }
        return new CaseExpr(predicate, thenExpr, elseExpr);
    }

    static Object evaluateCase(Map<String, Object> row, CaseExpr caseExpr) {
        boolean matched = matchesConjunct(row, caseExpr.predicate());
        return resolve(row, matched ? caseExpr.thenExpr() : caseExpr.elseExpr());
    }

    /**
     * Parse {@code CAST(expr AS type)}. Type may include optional length {@code VARCHAR(64)}.
     * Returns null when the token is not a CAST form.
     */
    static CastCall parseCast(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        String trimmed = token.trim();
        if (trimmed.length() < 8 || !trimmed.regionMatches(true, 0, "cast", 0, 4)) {
            return null;
        }
        int i = 4;
        while (i < trimmed.length() && Character.isWhitespace(trimmed.charAt(i))) {
            i++;
        }
        if (i >= trimmed.length() || trimmed.charAt(i) != '(') {
            return null;
        }
        String wrapped = trimmed.substring(i);
        if (!parensFullyWrap(wrapped) || !trimmed.endsWith(")")) {
            return null;
        }
        String body = wrapped.substring(1, wrapped.length() - 1).trim();
        int asIdx = findKeyword(body, "as", 2);
        if (asIdx < 0) {
            return null;
        }
        String expression = body.substring(0, asIdx).trim();
        String targetType = body.substring(asIdx + 2).trim();
        if (expression.isEmpty() || targetType.isEmpty()) {
            return null;
        }
        int typeParen = targetType.indexOf('(');
        String baseType = (typeParen > 0 ? targetType.substring(0, typeParen) : targetType)
                .trim()
                .toLowerCase(Locale.ROOT);
        if (baseType.isEmpty()) {
            return null;
        }
        return new CastCall(expression, baseType);
    }

    static Object applyCast(Object value, String targetType) {
        if (value == null) {
            return null;
        }
        String type = targetType == null ? "" : targetType.toLowerCase(Locale.ROOT);
        if (CAST_STRING_TYPES.contains(type)) {
            return String.valueOf(value);
        }
        if (CAST_INT_TYPES.contains(type)) {
            if (value instanceof Number number) {
                return number.longValue();
            }
            try {
                return (long) Double.parseDouble(String.valueOf(value).trim());
            } catch (NumberFormatException ex) {
                throw new IllegalArgumentException("CAST to " + targetType + " failed: " + value, ex);
            }
        }
        if (CAST_FLOAT_TYPES.contains(type)) {
            if (value instanceof Number number) {
                return number.doubleValue();
            }
            try {
                return Double.parseDouble(String.valueOf(value).trim());
            } catch (NumberFormatException ex) {
                throw new IllegalArgumentException("CAST to " + targetType + " failed: " + value, ex);
            }
        }
        if (CAST_BOOL_TYPES.contains(type)) {
            if (value instanceof Boolean bool) {
                return bool;
            }
            String text = String.valueOf(value).trim();
            if ("1".equals(text) || "true".equalsIgnoreCase(text) || "t".equalsIgnoreCase(text) || "yes".equalsIgnoreCase(text)) {
                return true;
            }
            if ("0".equals(text) || "false".equalsIgnoreCase(text) || "f".equalsIgnoreCase(text) || "no".equalsIgnoreCase(text)) {
                return false;
            }
            throw new IllegalArgumentException("CAST to BOOLEAN failed: " + value);
        }
        throw new IllegalArgumentException(
                "Unsupported CAST target type: " + targetType
                        + " (supported: VARCHAR/CHAR/TEXT, INT/BIGINT, DOUBLE/DECIMAL/NUMERIC, BOOLEAN)"
        );
    }

    private static Object applyFunction(Map<String, Object> row, FunctionCall call) {
        List<String> args = call.arguments();
        return switch (call.name()) {
            case "upper" -> {
                requireArity(call, 1);
                yield mapString(resolve(row, args.get(0)), s -> s.toUpperCase(Locale.ROOT));
            }
            case "lower" -> {
                requireArity(call, 1);
                yield mapString(resolve(row, args.get(0)), s -> s.toLowerCase(Locale.ROOT));
            }
            case "trim" -> {
                requireArity(call, 1);
                yield mapString(resolve(row, args.get(0)), String::trim);
            }
            case "ltrim" -> {
                requireArity(call, 1);
                yield mapString(resolve(row, args.get(0)), FederatedJoinResidualFilter::ltrim);
            }
            case "rtrim" -> {
                requireArity(call, 1);
                yield mapString(resolve(row, args.get(0)), FederatedJoinResidualFilter::rtrim);
            }
            case "length", "char_length" -> {
                requireArity(call, 1);
                Object inner = resolve(row, args.get(0));
                yield inner == null ? null : (long) String.valueOf(inner).length();
            }
            case "abs" -> {
                requireArity(call, 1);
                yield absValue(resolve(row, args.get(0)));
            }
            case "round" -> {
                if (args.isEmpty() || args.size() > 2) {
                    throw new IllegalArgumentException("ROUND requires 1 or 2 arguments (expr[, scale])");
                }
                yield roundValue(
                        resolve(row, args.get(0)),
                        args.size() == 2 ? resolve(row, args.get(1)) : null
                );
            }
            case "ceil", "ceiling" -> {
                requireArity(call, 1);
                yield ceilValue(resolve(row, args.get(0)));
            }
            case "floor" -> {
                requireArity(call, 1);
                yield floorValue(resolve(row, args.get(0)));
            }
            case "greatest", "least" -> {
                if (args.size() < 2) {
                    throw new IllegalArgumentException(
                            call.name().toUpperCase(Locale.ROOT) + " requires at least 2 arguments"
                    );
                }
                List<Object> values = new ArrayList<>(args.size());
                for (String arg : args) {
                    values.add(resolve(row, arg));
                }
                yield extremumValue(values, "greatest".equals(call.name()));
            }
            case "coalesce" -> {
                if (args.size() < 2) {
                    throw new IllegalArgumentException("COALESCE requires at least 2 arguments");
                }
                Object found = null;
                for (String arg : args) {
                    Object value = resolve(row, arg);
                    if (value != null) {
                        found = value;
                        break;
                    }
                }
                yield found;
            }
            case "nullif" -> {
                requireArity(call, 2);
                Object left = resolve(row, args.get(0));
                Object right = resolve(row, args.get(1));
                yield eq(left, right) ? null : left;
            }
            case "concat" -> {
                if (args.isEmpty()) {
                    throw new IllegalArgumentException("CONCAT requires at least 1 argument");
                }
                StringBuilder out = new StringBuilder();
                for (String arg : args) {
                    out.append(nullToEmpty(resolve(row, arg)));
                }
                yield out.toString();
            }
            case "substr", "substring" -> {
                if (args.size() < 2 || args.size() > 3) {
                    throw new IllegalArgumentException(
                            "SUBSTR/SUBSTRING requires 2 or 3 arguments (expr, start[, length])"
                    );
                }
                yield substringValue(
                        resolve(row, args.get(0)),
                        resolve(row, args.get(1)),
                        args.size() == 3 ? resolve(row, args.get(2)) : null
                );
            }
            default -> throw new IllegalArgumentException(
                    "Unsupported federated residual function: " + call.name()
            );
        };
    }

    private static void requireArity(FunctionCall call, int expected) {
        if (call.arguments().size() != expected) {
            throw new IllegalArgumentException(
                    call.name().toUpperCase(Locale.ROOT) + " requires " + expected + " argument(s)"
            );
        }
    }

    private static Object mapString(Object inner, java.util.function.Function<String, String> mapper) {
        if (inner == null) {
            return null;
        }
        return mapper.apply(String.valueOf(inner));
    }

    private static Object absValue(Object value) {
        if (value == null) {
            return null;
        }
        if (!(value instanceof Number number)) {
            throw new IllegalArgumentException("ABS requires a numeric argument: " + value);
        }
        if (value instanceof Double || value instanceof Float) {
            return Math.abs(number.doubleValue());
        }
        return Math.abs(number.longValue());
    }

    /** SQL-style {@code ROUND(expr[, scale])}; scale defaults to 0 (nearest long). */
    static Object roundValue(Object value, Object scaleObj) {
        if (value == null) {
            return null;
        }
        double number = toDouble(value, "ROUND");
        int scale = scaleObj == null ? 0 : toInt(scaleObj, "ROUND scale");
        if (scale == 0) {
            return Math.round(number);
        }
        double factor = Math.pow(10, scale);
        return Math.round(number * factor) / factor;
    }

    static Object ceilValue(Object value) {
        if (value == null) {
            return null;
        }
        return (long) Math.ceil(toDouble(value, "CEIL"));
    }

    static Object floorValue(Object value) {
        if (value == null) {
            return null;
        }
        return (long) Math.floor(toDouble(value, "FLOOR"));
    }

    /**
     * MySQL-style extremum: ignore NULL arguments; return null when every argument is null.
     */
    static Object extremumValue(List<Object> values, boolean greatest) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        Object best = null;
        boolean found = false;
        for (Object value : values) {
            if (value == null) {
                continue;
            }
            if (!found) {
                best = value;
                found = true;
                continue;
            }
            int cmp = compareValues(value, best);
            if ((greatest && cmp > 0) || (!greatest && cmp < 0)) {
                best = value;
            }
        }
        return found ? best : null;
    }

    private static double toDouble(Object value, String label) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(value).trim());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(label + " requires a numeric argument: " + value, ex);
        }
    }

    private static String nullToEmpty(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static Object concatValues(Object left, Object right) {
        return nullToEmpty(left) + nullToEmpty(right);
    }

    /** SQL-style 1-based {@code SUBSTR}; {@code start < 1} clamps to 1. */
    static Object substringValue(Object source, Object startObj, Object lengthObj) {
        if (source == null || startObj == null) {
            return null;
        }
        String text = String.valueOf(source);
        int start = toInt(startObj, "SUBSTR start");
        if (start < 1) {
            start = 1;
        }
        if (start > text.length()) {
            return "";
        }
        int from = start - 1;
        if (lengthObj == null) {
            return text.substring(from);
        }
        int length = toInt(lengthObj, "SUBSTR length");
        if (length <= 0) {
            return "";
        }
        int to = Math.min(text.length(), from + length);
        return text.substring(from, to);
    }

    private static int toInt(Object value, String label) {
        if (value instanceof Number number) {
            return numberToInt(number, label);
        }
        try {
            return numberToInt(Double.parseDouble(String.valueOf(value)), label);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(label + " must be numeric: " + value, ex);
        }
    }

    private static int numberToInt(Number number, String label) {
        if (number instanceof Double || number instanceof Float || number instanceof java.math.BigDecimal) {
            double d = number.doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d)) {
                throw new IllegalArgumentException(label + " must be a finite number: " + number);
            }
            // Truncate toward zero (SQL CAST to integer style), then require int range.
            return longToInt((long) d, label, number);
        }
        return longToInt(number.longValue(), label, number);
    }

    private static int longToInt(long value, String label, Object original) {
        if (value < Integer.MIN_VALUE || value > Integer.MAX_VALUE) {
            throw new IllegalArgumentException(label + " out of int range: " + original);
        }
        return (int) value;
    }

    /**
     * Parse a supported residual function call {@code NAME(arg[, …])} (parens must fully wrap
     * the argument list). Returns null when the token is not a function shape.
     * Unknown function names throw.
     */
    static FunctionCall parseFunctionCall(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        String trimmed = token.trim();
        int open = trimmed.indexOf('(');
        if (open <= 0 || !trimmed.endsWith(")")) {
            return null;
        }
        String name = trimmed.substring(0, open).trim().toLowerCase(Locale.ROOT);
        if (name.isEmpty() || !isIdentStart(name.charAt(0))) {
            return null;
        }
        for (int i = 1; i < name.length(); i++) {
            if (!isIdentChar(name.charAt(i))) {
                return null;
            }
        }
        String wrapped = trimmed.substring(open);
        if (!parensFullyWrap(wrapped)) {
            return null;
        }
        String body = wrapped.substring(1, wrapped.length() - 1).trim();
        List<String> args = splitFunctionArgs(body);
        if (!SUPPORTED_FUNCTIONS.contains(name)) {
            throw new IllegalArgumentException(
                    "Unsupported federated residual function: " + name
                            + " (supported: " + String.join(", ", SUPPORTED_FUNCTIONS.stream().sorted().toList()) + ")"
            );
        }
        if (args.isEmpty() && !"concat".equals(name)) {
            return null;
        }
        return new FunctionCall(name, args);
    }

    /** @deprecated use {@link #parseFunctionCall(String)}; kept for unary string call sites. */
    static FunctionCall parseUnaryStringFunction(String token) {
        FunctionCall call = parseFunctionCall(token);
        if (call == null || call.arguments().size() != 1) {
            return null;
        }
        String name = call.name();
        if (!"upper".equals(name)
                && !"lower".equals(name)
                && !"trim".equals(name)
                && !"ltrim".equals(name)
                && !"rtrim".equals(name)
                && !"length".equals(name)
                && !"char_length".equals(name)
                && !"abs".equals(name)) {
            return null;
        }
        return call;
    }

    static List<String> splitFunctionArgs(String body) {
        List<String> args = new ArrayList<>();
        if (body == null || body.isBlank()) {
            return args;
        }
        StringBuilder current = new StringBuilder();
        int depth = 0;
        boolean inSingle = false;
        boolean inDouble = false;
        for (int i = 0; i < body.length(); i++) {
            char ch = body.charAt(i);
            if (ch == '\'' && !inDouble) {
                inSingle = !inSingle;
                current.append(ch);
            } else if (ch == '"' && !inSingle) {
                inDouble = !inDouble;
                current.append(ch);
            } else if (!inSingle && !inDouble) {
                if (ch == '(') {
                    depth++;
                    current.append(ch);
                } else if (ch == ')') {
                    depth = Math.max(0, depth - 1);
                    current.append(ch);
                } else if (ch == ',' && depth == 0) {
                    String part = current.toString().trim();
                    if (!part.isEmpty()) {
                        args.add(part);
                    }
                    current = new StringBuilder();
                } else {
                    current.append(ch);
                }
            } else {
                current.append(ch);
            }
        }
        String last = current.toString().trim();
        if (!last.isEmpty()) {
            args.add(last);
        }
        return args;
    }

    private static boolean isIdentStart(char ch) {
        return Character.isLetter(ch) || ch == '_';
    }

    /** Leading whitespace strip matching {@link String#trim()} (chars {@code <= ' '}). */
    static String ltrim(String text) {
        int i = 0;
        while (i < text.length() && text.charAt(i) <= ' ') {
            i++;
        }
        return text.substring(i);
    }

    /** Trailing whitespace strip matching {@link String#trim()} (chars {@code <= ' '}). */
    static String rtrim(String text) {
        int i = text.length();
        while (i > 0 && text.charAt(i - 1) <= ' ') {
            i--;
        }
        return text.substring(0, i);
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

    record InPredicate(String left, boolean negated, List<Object> values) {
    }

    record NullCheck(String column, boolean negated) {
    }

    record LikePredicate(String left, boolean negated, String pattern, Character escape) {
    }

    record BetweenPredicate(String left, boolean negated, String low, String high) {
    }

    record StringLiteralTake(String value, String remainder) {
    }

    record FunctionCall(String name, List<String> arguments) {
        /** Convenience for single-arg unary calls. */
        String argument() {
            return arguments.isEmpty() ? "" : arguments.get(0);
        }
    }

    record CastCall(String expression, String targetType) {
    }

    record CaseExpr(String predicate, String thenExpr, String elseExpr) {
    }
}
