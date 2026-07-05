package org.apache.datawise.backend.ai.support;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 从 SQL 中提取 FROM / JOIN 引用的表名（不含别名）
 */
public final class AiSqlReferencedTables {

    private static final Pattern FROM_JOIN = Pattern.compile(
            "(?i)\\b(?:from|join)\\s+(?:`([^`]+)`|\"([^\"]+)\"|\\[([^\\]]+)\\]|([a-zA-Z0-9_.]+))"
    );

    private AiSqlReferencedTables() {
    }

    public static List<String> extract(String sql) {
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
            table = table.trim();
            if (!table.isBlank() && !isKeyword(table)) {
                names.add(table);
            }
        }
        return new ArrayList<>(names);
    }

    private static boolean isKeyword(String token) {
        return switch (token.toLowerCase(Locale.ROOT)) {
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
