package org.apache.datawise.backend.dml.render;

import java.time.temporal.TemporalAccessor;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** DML 渲染通用 SQL 片段工具。 */
public final class DmlSqlSupport {

    private DmlSqlSupport() {
    }

    public static String sanitizeIdentifier(String name) {
        return name.replace("`", "").replace("\"", "");
    }

    public static String sqlLiteral(Object value) {
        if (value == null) {
            return "NULL";
        }
        if (value instanceof Number || value instanceof Boolean) {
            return String.valueOf(value);
        }
        if (value instanceof byte[]) {
            return "NULL";
        }
        if (value instanceof java.util.Date date) {
            return "'" + new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss")
                    .format(date).replace("'", "''") + "'";
        }
        if (value instanceof TemporalAccessor) {
            return "'" + String.valueOf(value).replace("'", "''") + "'";
        }
        return "'" + String.valueOf(value).replace("'", "''") + "'";
    }

    /** 拼装 {@code col = val AND ...} 等值条件。 */
    public static String buildWhereEquals(Function<String, String> quoteFn, Map<String, Object> values) {
        return values.entrySet().stream()
                .map(entry -> quoteFn.apply(entry.getKey()) + " = " + sqlLiteral(entry.getValue()))
                .collect(Collectors.joining(" AND "));
    }
}
