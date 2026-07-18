package org.apache.datawise.backend.lineage.parser.lakehouse;

import org.apache.datawise.backend.common.DbType;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Detects lakehouse-only SQL features and strips clauses that are safe to ignore for column lineage.
 */
public final class LakehouseSqlSupport {

    public static final Set<String> LAKEHOUSE_DB_TYPES = Set.of(
            DbType.HIVE.id(),
            DbType.FLINK.id(),
            DbType.KYLIN.id(),
            DbType.TRINO.id(),
            DbType.PRESTO.id(),
            "spark",
            "impala"
    );

    private static final Pattern LATERAL_VIEW = Pattern.compile("\\bLATERAL\\s+VIEW\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern MATCH_RECOGNIZE = Pattern.compile("\\bMATCH_RECOGNIZE\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern WINDOW_TVF = Pattern.compile(
            "\\b(TUMBLE|HOP|CUMULATE|SESSION)\\s*\\(",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern DISTRIBUTE_BY = Pattern.compile(
            "\\bDISTRIBUTE\\s+BY\\b[^;]*",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern CLUSTER_BY = Pattern.compile(
            "\\bCLUSTER\\s+BY\\b[^;]*",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern SORT_BY = Pattern.compile(
            "\\bSORT\\s+BY\\b[^;]*",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern INSERT_OVERWRITE = Pattern.compile(
            "\\bINSERT\\s+OVERWRITE\\b",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern INSERT_PARTITION = Pattern.compile(
            "\\b(INSERT\\s+(?:INTO|OVERWRITE)(?:\\s+TABLE)?)\\s+([`\"\\[]?[\\w.]+[`\"\\]]?)\\s+PARTITION\\s*\\([^)]*\\)",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern TABLESAMPLE = Pattern.compile(
            "\\bTABLESAMPLE\\s*\\([^)]*\\)",
            Pattern.CASE_INSENSITIVE
    );
    /** Hive LATERAL VIEW … AS cols — strip through next major clause or EOS. */
    private static final Pattern LATERAL_VIEW_CLAUSE = Pattern.compile(
            "(?is)\\bLATERAL\\s+VIEW\\s+(?:OUTER\\s+)?.+?(?=\\s+(?:LATERAL\\s+VIEW|WHERE|GROUP\\s+BY|ORDER\\s+BY|HAVING|LIMIT|DISTRIBUTE\\s+BY|CLUSTER\\s+BY|SORT\\s+BY|UNION|EXCEPT|INTERSECT)|;|$)"
    );
    private static final Pattern WINDOW_TVF_TABLE = Pattern.compile(
            "(?is)\\bTABLE\\s*\\(\\s*(TUMBLE|HOP|CUMULATE|SESSION)\\s*\\(\\s*TABLE\\s+([`\"\\[]?[\\w.]+[`\"\\]]?)"
    );
    private static final Pattern FROM_JOIN = Pattern.compile(
            "(?i)\\b(?:from|join)\\s+(?:`([^`]+)`|\"([^\"]+)\"|\\[([^\\]]+)\\]|([a-zA-Z0-9_.]+))"
    );
    private static final Set<String> TABLE_KEYWORDS = Set.of(
            "select", "where", "join", "inner", "left", "right", "full", "outer", "cross",
            "on", "as", "lateral", "values", "unnest", "table", "dual"
    );

    private LakehouseSqlSupport() {
    }

    public static boolean isLakehouseDialect(String dbType) {
        if (dbType == null || dbType.isBlank()) {
            return false;
        }
        String normalized = DbType.normalizeId(dbType);
        if (LAKEHOUSE_DB_TYPES.contains(normalized)) {
            return true;
        }
        return DbType.HIVE.matches(dbType)
                || DbType.FLINK.matches(dbType)
                || DbType.TRINO.matches(dbType)
                || DbType.PRESTO.matches(dbType)
                || DbType.KYLIN.matches(dbType);
    }

    /** Features that cannot be reduced to standard SELECT lineage without a stronger engine. */
    public static List<LakehouseFeature> detectHardFeatures(String sql) {
        if (sql == null || sql.isBlank()) {
            return List.of();
        }
        List<LakehouseFeature> features = new ArrayList<>();
        if (LATERAL_VIEW.matcher(sql).find()) {
            features.add(LakehouseFeature.LATERAL_VIEW);
        }
        if (MATCH_RECOGNIZE.matcher(sql).find()) {
            features.add(LakehouseFeature.MATCH_RECOGNIZE);
        }
        if (WINDOW_TVF.matcher(sql).find()) {
            features.add(LakehouseFeature.WINDOW_TVF);
        }
        return List.copyOf(features);
    }

    /**
     * Softens hard features into AST-friendly SQL when possible (best-effort).
     * Column lineage from softened SQL is always PARTIAL.
     */
    public static SoftenResult softenHardFeatures(String sql) {
        if (sql == null || sql.isBlank()) {
            return new SoftenResult(sql == null ? "" : sql, List.of());
        }
        String current = sql;
        Set<String> applied = new LinkedHashSet<>();

        Matcher lateral = LATERAL_VIEW_CLAUSE.matcher(current);
        if (lateral.find()) {
            current = lateral.replaceAll(" ").replaceAll("\\s{2,}", " ").trim();
            applied.add("LATERAL_VIEW");
        }

        Matcher tvf = WINDOW_TVF_TABLE.matcher(current);
        if (tvf.find()) {
            StringBuilder rebuilt = new StringBuilder();
            int last = 0;
            Matcher m = WINDOW_TVF_TABLE.matcher(current);
            while (m.find()) {
                int open = current.indexOf('(', m.start());
                int close = findMatchingParen(current, open);
                if (close < 0) {
                    continue;
                }
                rebuilt.append(current, last, m.start());
                rebuilt.append(stripQuotes(m.group(2)));
                last = close + 1;
                applied.add("WINDOW_TVF");
            }
            if (last > 0) {
                rebuilt.append(current.substring(last));
                current = rebuilt.toString().replaceAll("\\s{2,}", " ").trim();
            }
        }

        int matchIdx = indexOfIgnoreCase(current, "MATCH_RECOGNIZE");
        if (matchIdx >= 0) {
            int open = current.indexOf('(', matchIdx);
            int close = open >= 0 ? findMatchingParen(current, open) : -1;
            if (close >= 0) {
                current = (current.substring(0, matchIdx) + " " + current.substring(close + 1))
                        .replaceAll("\\s{2,}", " ")
                        .trim();
                applied.add("MATCH_RECOGNIZE");
            }
        }

        return new SoftenResult(current, List.copyOf(applied));
    }

    public static NormalizationResult normalizeForLineage(String sql) {
        if (sql == null || sql.isBlank()) {
            return new NormalizationResult(sql == null ? "" : sql, List.of());
        }
        String current = sql;
        Set<String> applied = new LinkedHashSet<>();

        Matcher partition = INSERT_PARTITION.matcher(current);
        if (partition.find()) {
            current = partition.replaceAll("$1 $2");
            applied.add("INSERT_PARTITION");
        }

        String next = INSERT_OVERWRITE.matcher(current).replaceAll("INSERT INTO");
        if (!next.equals(current)) {
            applied.add("INSERT_OVERWRITE");
            current = next;
        }
        next = stripTrailingClause(current, DISTRIBUTE_BY);
        if (next != null) {
            applied.add("DISTRIBUTE_BY");
            current = next;
        }
        next = stripTrailingClause(current, CLUSTER_BY);
        if (next != null) {
            applied.add("CLUSTER_BY");
            current = next;
        }
        next = stripTrailingClause(current, SORT_BY);
        if (next != null) {
            applied.add("SORT_BY");
            current = next;
        }
        Matcher sample = TABLESAMPLE.matcher(current);
        if (sample.find()) {
            current = sample.replaceAll("");
            applied.add("TABLESAMPLE");
        }
        return new NormalizationResult(current.trim(), List.copyOf(applied));
    }

    /**
     * Best-effort physical table names from FROM / JOIN (for table-level lineage fallback).
     */
    public static List<String> extractPhysicalTables(String sql) {
        if (sql == null || sql.isBlank()) {
            return List.of();
        }
        Set<String> names = new LinkedHashSet<>();
        Matcher matcher = FROM_JOIN.matcher(sql);
        while (matcher.find()) {
            String raw = firstNonBlank(matcher.group(1), matcher.group(2), matcher.group(3), matcher.group(4));
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String table = raw.contains(".") ? raw.substring(raw.lastIndexOf('.') + 1) : raw;
            table = stripQuotes(table).trim();
            if (!table.isBlank() && !TABLE_KEYWORDS.contains(table.toLowerCase(Locale.ROOT))) {
                names.add(table);
            }
        }
        // Flink TABLE(TUMBLE(TABLE orders, …)) — capture inner TABLE name when FROM missed it
        Matcher tvf = WINDOW_TVF_TABLE.matcher(sql);
        while (tvf.find()) {
            String table = stripQuotes(tvf.group(2));
            if (table.contains(".")) {
                table = table.substring(table.lastIndexOf('.') + 1);
            }
            if (!table.isBlank()) {
                names.add(table);
            }
        }
        return List.copyOf(names);
    }

    private static String stripTrailingClause(String sql, Pattern pattern) {
        Matcher matcher = pattern.matcher(sql);
        if (!matcher.find()) {
            return null;
        }
        return matcher.replaceAll(" ").replaceAll("\\s{2,}", " ").trim();
    }

    private static int findMatchingParen(String sql, int openIdx) {
        if (openIdx < 0 || openIdx >= sql.length() || sql.charAt(openIdx) != '(') {
            return -1;
        }
        int depth = 0;
        for (int i = openIdx; i < sql.length(); i++) {
            char c = sql.charAt(i);
            if (c == '(') {
                depth++;
            } else if (c == ')') {
                depth--;
                if (depth == 0) {
                    return i;
                }
            }
        }
        return -1;
    }

    private static int indexOfIgnoreCase(String haystack, String needle) {
        return haystack.toLowerCase(Locale.ROOT).indexOf(needle.toLowerCase(Locale.ROOT));
    }

    private static String stripQuotes(String raw) {
        if (raw == null || raw.length() < 2) {
            return raw == null ? "" : raw;
        }
        char first = raw.charAt(0);
        char last = raw.charAt(raw.length() - 1);
        if ((first == '`' && last == '`')
                || (first == '"' && last == '"')
                || (first == '[' && last == ']')) {
            return raw.substring(1, raw.length() - 1);
        }
        return raw;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    public enum LakehouseFeature {
        LATERAL_VIEW("Hive LATERAL VIEW / explode is not supported for automatic lineage yet"),
        MATCH_RECOGNIZE("MATCH_RECOGNIZE pattern matching is not supported for automatic lineage yet"),
        WINDOW_TVF("Flink window TVFs (TUMBLE/HOP/CUMULATE/SESSION) are not supported for automatic lineage yet");

        private final String message;

        LakehouseFeature(String message) {
            this.message = message;
        }

        public String code() {
            return "LAKEHOUSE_" + name();
        }

        public String message() {
            return message;
        }
    }

    public record NormalizationResult(String sql, List<String> strippedClauses) {
        public boolean changed() {
            return strippedClauses != null && !strippedClauses.isEmpty();
        }
    }

    public record SoftenResult(String sql, List<String> softenedFeatures) {
        public boolean changed() {
            return softenedFeatures != null && !softenedFeatures.isEmpty();
        }
    }
}
