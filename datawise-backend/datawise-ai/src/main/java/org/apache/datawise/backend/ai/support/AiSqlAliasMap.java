package org.apache.datawise.backend.ai.support;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 从 FROM / JOIN 子句解析表别名 → 真实表名。
 */
public final class AiSqlAliasMap {

    private static final Pattern FROM_JOIN = Pattern.compile(
            "(?is)\\b(?:from|join)\\s+"
                    + "(?:`([^`]+)`|\"([^\"]+)\"|\\[([^\\]]+)\\]|([a-zA-Z0-9_.]+))"
                    + "(?:\\s+(?:as\\s+)?(?:`([^`]+)`|\"([^\"]+)\"|([a-zA-Z_][a-zA-Z0-9_]*)))?"
    );

    private AiSqlAliasMap() {
    }

    public static Map<String, String> build(String sql) {
        Map<String, String> aliasToTable = new HashMap<>();
        if (sql == null || sql.isBlank()) {
            return aliasToTable;
        }
        Matcher matcher = FROM_JOIN.matcher(sql);
        while (matcher.find()) {
            String tableRaw = firstNonBlank(matcher.group(1), matcher.group(2), matcher.group(3), matcher.group(4));
            if (tableRaw == null || tableRaw.isBlank()) {
                continue;
            }
            String table = tableNameOnly(tableRaw).toLowerCase(Locale.ROOT);
            if (table.isBlank() || isKeyword(table)) {
                continue;
            }
            String aliasRaw = firstNonBlank(matcher.group(5), matcher.group(6), matcher.group(7));
            String alias = aliasRaw != null && !aliasRaw.isBlank()
                    ? aliasRaw.toLowerCase(Locale.ROOT)
                    : table;
            aliasToTable.put(alias, table);
            aliasToTable.put(table, table);
        }
        return aliasToTable;
    }

    public static String resolveTable(String tableOrAlias, Map<String, String> aliasToTable) {
        if (tableOrAlias == null || tableOrAlias.isBlank()) {
            return "";
        }
        String key = tableOrAlias.toLowerCase(Locale.ROOT);
        return aliasToTable.getOrDefault(key, key);
    }

    private static String tableNameOnly(String raw) {
        String trimmed = raw.trim();
        if (trimmed.contains(".")) {
            return trimmed.substring(trimmed.lastIndexOf('.') + 1);
        }
        return trimmed;
    }

    private static boolean isKeyword(String token) {
        return switch (token) {
            case "select", "where", "on", "lateral" -> true;
            default -> false;
        };
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
