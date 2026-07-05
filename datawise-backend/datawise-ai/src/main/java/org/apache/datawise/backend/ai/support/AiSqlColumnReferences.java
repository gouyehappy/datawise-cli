package org.apache.datawise.backend.ai.support;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 从只读 SELECT SQL 中提取列引用（限定名 table.col / 未限定名）。
 */
public final class AiSqlColumnReferences {

    private static final Pattern QUALIFIED = Pattern.compile(
            "\\b([a-zA-Z_][a-zA-Z0-9_]*)\\.([a-zA-Z_*][a-zA-Z0-9_]*)\\b"
    );

    private static final Pattern IDENTIFIER = Pattern.compile("\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b");

    private static final Pattern SELECT_CLAUSE = Pattern.compile("(?is)\\bselect\\s+(.*?)\\bfrom\\b");

    private static final Pattern CLAUSE = Pattern.compile(
            "(?is)\\b(where|on|group\\s+by|order\\s+by|having)\\s+(.*?)(?=\\b(?:group\\s+by|order\\s+by|having|limit|union|join|from|$))"
    );

    private static final Set<String> SQL_KEYWORDS = Set.of(
            "select", "from", "where", "join", "inner", "left", "right", "full", "outer", "cross",
            "on", "as", "and", "or", "not", "in", "is", "null", "like", "between", "exists",
            "case", "when", "then", "else", "end", "distinct", "all", "any", "some", "union",
            "group", "by", "order", "having", "limit", "offset", "asc", "desc", "with", "recursive",
            "true", "false", "interval", "over", "partition", "rows", "range", "preceding",
            "following", "current", "row", "unbounded", "lateral", "using", "natural", "into",
            "set", "values", "dual"
    );

    private static final Set<String> SQL_FUNCTIONS = Set.of(
            "count", "sum", "avg", "min", "max", "coalesce", "if", "ifnull", "nullif", "cast",
            "convert", "date", "year", "month", "day", "hour", "minute", "second", "now",
            "curdate", "curtime", "substring", "substr", "trim", "upper", "lower", "length",
            "char_length", "concat", "round", "floor", "ceil", "abs", "mod", "pow", "sqrt",
            "rand", "uuid", "group_concat", "json_extract", "json_unquote", "extract", "datediff",
            "date_add", "date_sub", "timestampdiff", "str_to_date", "format", "replace", "left",
            "right", "instr", "locate", "position", "find_in_set", "least", "greatest", "sign",
            "truncate", "exp", "log", "ln", "pi", "degrees", "radians", "atan", "atan2", "cos",
            "sin", "tan", "cot", "asin", "acos", "bit_and", "bit_or", "bit_xor", "std", "stddev",
            "variance", "var_pop", "var_samp", "stddev_pop", "stddev_samp", "first", "last"
    );

    private AiSqlColumnReferences() {
    }

    public record QualifiedColumn(String tableOrAlias, String column) {
    }

    public static List<QualifiedColumn> extractQualified(String sql) {
        if (sql == null || sql.isBlank()) {
            return List.of();
        }
        String normalized = stripLiterals(sql);
        List<QualifiedColumn> refs = new ArrayList<>();
        Matcher matcher = QUALIFIED.matcher(normalized);
        while (matcher.find()) {
            String tableOrAlias = matcher.group(1);
            String column = matcher.group(2);
            if (column == null || column.isBlank() || "*".equals(column)) {
                continue;
            }
            refs.add(new QualifiedColumn(tableOrAlias, column));
        }
        return refs;
    }

    public static List<String> extractUnqualified(String sql, Map<String, String> aliasToTable) {
        if (sql == null || sql.isBlank()) {
            return List.of();
        }
        String normalized = stripLiterals(sql);
        String withoutQualified = QUALIFIED.matcher(normalized).replaceAll(" ");
        Set<String> skip = buildSkipTokens(aliasToTable);
        skip.addAll(extractSelectAliases(normalized));

        LinkedHashSet<String> columns = new LinkedHashSet<>();
        collectFromSelectClause(withoutQualified, skip, columns);
        collectFromOtherClauses(withoutQualified, skip, columns);
        return new ArrayList<>(columns);
    }

    private static Set<String> extractSelectAliases(String sql) {
        Set<String> aliases = new HashSet<>();
        Matcher selectMatcher = SELECT_CLAUSE.matcher(sql);
        if (!selectMatcher.find()) {
            return aliases;
        }
        for (String item : splitSelectItems(selectMatcher.group(1))) {
            Matcher asMatcher = Pattern.compile("(?is)\\s+as\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*$").matcher(item.trim());
            if (asMatcher.find()) {
                aliases.add(asMatcher.group(1).toLowerCase(Locale.ROOT));
            }
        }
        return aliases;
    }

    private static void collectFromSelectClause(String sql, Set<String> skip, Set<String> columns) {
        Matcher selectMatcher = SELECT_CLAUSE.matcher(sql);
        if (!selectMatcher.find()) {
            return;
        }
        String selectBody = selectMatcher.group(1);
        if (selectBody == null || selectBody.isBlank()) {
            return;
        }
        for (String item : splitSelectItems(selectBody)) {
            String expr = stripTrailingAlias(item).trim();
            if (expr.equals("*") || expr.matches("(?i)[a-zA-Z_][a-zA-Z0-9_]*\\.\\*")) {
                continue;
            }
            collectIdentifiers(expr, skip, columns);
        }
    }

    private static void collectFromOtherClauses(String sql, Set<String> skip, Set<String> columns) {
        Matcher clauseMatcher = CLAUSE.matcher(sql);
        while (clauseMatcher.find()) {
            String body = clauseMatcher.group(2);
            if (body != null && !body.isBlank()) {
                collectIdentifiers(body, skip, columns);
            }
        }
    }

    private static List<String> splitSelectItems(String selectBody) {
        List<String> items = new ArrayList<>();
        int depth = 0;
        int start = 0;
        for (int i = 0; i < selectBody.length(); i++) {
            char ch = selectBody.charAt(i);
            if (ch == '(') {
                depth++;
            } else if (ch == ')') {
                depth = Math.max(0, depth - 1);
            } else if (ch == ',' && depth == 0) {
                items.add(selectBody.substring(start, i));
                start = i + 1;
            }
        }
        items.add(selectBody.substring(start));
        return items;
    }

    private static String stripTrailingAlias(String item) {
        String trimmed = item.trim();
        Matcher asMatcher = Pattern.compile("(?is)\\s+as\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*$").matcher(trimmed);
        if (asMatcher.find()) {
            return trimmed.substring(0, asMatcher.start()).trim();
        }
        return trimmed;
    }

    private static void collectIdentifiers(String text, Set<String> skip, Set<String> columns) {
        Matcher matcher = IDENTIFIER.matcher(text);
        while (matcher.find()) {
            String token = matcher.group(1);
            if (token == null || token.isBlank()) {
                continue;
            }
            String lower = token.toLowerCase(Locale.ROOT);
            if (skip.contains(lower) || SQL_KEYWORDS.contains(lower) || SQL_FUNCTIONS.contains(lower)) {
                continue;
            }
            columns.add(lower);
        }
    }

    private static Set<String> buildSkipTokens(Map<String, String> aliasToTable) {
        Set<String> skip = new HashSet<>(SQL_KEYWORDS);
        skip.addAll(SQL_FUNCTIONS);
        if (aliasToTable != null) {
            skip.addAll(aliasToTable.keySet());
            skip.addAll(aliasToTable.values());
        }
        return skip;
    }

    private static String stripLiterals(String sql) {
        String noSingle = sql.replaceAll("'(?:''|[^'])*'", " ");
        return noSingle.replaceAll("\"(?:\\\"|[^\"])*\"", " ");
    }
}
