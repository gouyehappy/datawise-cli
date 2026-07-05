package org.apache.datawise.backend.domain;

public record TableColumnDetail(
        int ordinal,
        String name,
        String dataType,
        boolean nullable,
        boolean autoIncrement,
        String keyType,
        String defaultValue,
        String extra,
        String comment
) {
}
