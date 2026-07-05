package org.apache.datawise.backend.connector.api.support;

import org.apache.datawise.backend.jdbc.support.JdbcCellValues;
import org.junit.jupiter.api.Test;
import org.postgresql.util.PGobject;

import java.sql.Date;
import java.sql.Time;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class JdbcCellValuesTest {

    @Test
    void normalize_keepsScalars() {
        assertEquals("hello", JdbcCellValues.normalize("hello"));
        assertEquals(42, JdbcCellValues.normalize(42));
        assertEquals(true, JdbcCellValues.normalize(true));
    }

    @Test
    void normalize_mapsNestedStructures() {
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("source", "doc");
        input.put("tags", List.of("a", "b"));

        Object normalized = JdbcCellValues.normalize(input);
        assertInstanceOf(Map.class, normalized);
        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) normalized;
        assertEquals("doc", map.get("source"));
        assertEquals(List.of("a", "b"), map.get("tags"));
    }

    @Test
    void normalize_sqlDateAndTime_withoutToInstant() {
        assertEquals("2024-03-15", JdbcCellValues.normalize(Date.valueOf("2024-03-15")));
        assertEquals("14:30", JdbcCellValues.normalize(Time.valueOf("14:30:00")));
        assertEquals(
                "2024-03-15T08:00:00Z",
                JdbcCellValues.normalize(Timestamp.from(java.time.Instant.parse("2024-03-15T08:00:00Z")))
        );
    }

    @Test
    void normalize_pgObjectViaReflection() {
        PGobject pgObject = new PGobject();
        pgObject.setValue("{\"source\":\"doc\"}");
        assertEquals("{\"source\":\"doc\"}", JdbcCellValues.normalize(pgObject));
    }
}
