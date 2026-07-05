package org.apache.datawise.backend.jdbc.support;

import java.sql.Array;
import java.sql.Clob;
import java.sql.Date;
import java.sql.SQLException;
import java.sql.SQLXML;
import java.sql.Time;
import java.sql.Timestamp;
import java.time.temporal.TemporalAccessor;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 将 JDBC {@code ResultSet#getObject} 返回值规范为 JSON 可序列化、前端可展示的标量或结构。
 */
public final class JdbcCellValues {

    private JdbcCellValues() {
    }

    public static Object normalize(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String || value instanceof Number || value instanceof Boolean) {
            return value;
        }
        if (value instanceof byte[] bytes) {
            return bytesToHex(bytes);
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant().toString();
        }
        if (value instanceof Date sqlDate) {
            return sqlDate.toLocalDate().toString();
        }
        if (value instanceof Time sqlTime) {
            return sqlTime.toLocalTime().toString();
        }
        if (value instanceof TemporalAccessor temporal) {
            return temporal.toString();
        }
        if (value instanceof java.util.Date date) {
            return date.toInstant().toString();
        }
        if (value instanceof Clob clob) {
            return readClob(clob);
        }
        if (value instanceof SQLXML xml) {
            return readSqlXml(xml);
        }
        if (value instanceof Array array) {
            return normalizeArray(array);
        }
        String pgObjectValue = readPgObjectValue(value);
        if (pgObjectValue != null) {
            return pgObjectValue;
        }
        if (value instanceof Map<?, ?> map) {
            return normalizeMap(map);
        }
        if (value instanceof List<?> list) {
            return normalizeList(list);
        }
        if (value.getClass().isArray()) {
            return normalizeObjectArray(value);
        }
        return String.valueOf(value);
    }

    private static String readPgObjectValue(Object value) {
        if (!"org.postgresql.util.PGobject".equals(value.getClass().getName())) {
            return null;
        }
        try {
            Object raw = value.getClass().getMethod("getValue").invoke(value);
            return raw != null ? raw.toString() : null;
        } catch (ReflectiveOperationException ex) {
            return null;
        }
    }

    private static List<Object> normalizeArray(Array array) {
        try {
            Object raw = array.getArray();
            if (raw instanceof Object[] values) {
                return normalizeList(List.of(values));
            }
            return List.of(String.valueOf(raw));
        } catch (SQLException ex) {
            return List.of();
        }
    }

    private static List<Object> normalizeObjectArray(Object value) {
        int length = java.lang.reflect.Array.getLength(value);
        List<Object> items = new ArrayList<>(length);
        for (int i = 0; i < length; i++) {
            items.add(normalize(java.lang.reflect.Array.get(value, i)));
        }
        return items;
    }

    private static Map<String, Object> normalizeMap(Map<?, ?> map) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            normalized.put(String.valueOf(entry.getKey()), normalize(entry.getValue()));
        }
        return normalized;
    }

    private static List<Object> normalizeList(List<?> list) {
        List<Object> normalized = new ArrayList<>(list.size());
        for (Object item : list) {
            normalized.add(normalize(item));
        }
        return normalized;
    }

    private static String readClob(Clob clob) {
        try {
            long length = clob.length();
            if (length <= 0) {
                return "";
            }
            int readLength = (int) Math.min(length, 4096);
            return clob.getSubString(1, readLength);
        } catch (SQLException ex) {
            return "";
        }
    }

    private static String readSqlXml(SQLXML xml) {
        try {
            return xml.getString();
        } catch (SQLException ex) {
            return "";
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            sb.append(String.format("%02x", value));
        }
        return sb.toString();
    }
}
