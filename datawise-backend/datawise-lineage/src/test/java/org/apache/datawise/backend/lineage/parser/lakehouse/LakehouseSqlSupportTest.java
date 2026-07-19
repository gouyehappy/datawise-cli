package org.apache.datawise.backend.lineage.parser.lakehouse;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LakehouseSqlSupportTest {

    @Test
    void stripsHiveDistributeBy() {
        LakehouseSqlSupport.NormalizationResult result = LakehouseSqlSupport.normalizeForLineage(
                "SELECT a FROM t DISTRIBUTE BY a"
        );
        assertTrue(result.changed());
        assertTrue(result.strippedClauses().contains("DISTRIBUTE_BY"));
        assertEquals("SELECT a FROM t", result.sql());
    }

    @Test
    void rewritesInsertOverwrite() {
        LakehouseSqlSupport.NormalizationResult result = LakehouseSqlSupport.normalizeForLineage(
                "INSERT OVERWRITE TABLE t SELECT 1"
        );
        assertTrue(result.strippedClauses().contains("INSERT_OVERWRITE"));
        assertTrue(result.sql().toUpperCase().startsWith("INSERT INTO"));
    }

    @Test
    void detectsFlinkWindowTvf() {
        var features = LakehouseSqlSupport.detectHardFeatures(
                "SELECT * FROM TABLE(TUMBLE(TABLE orders, DESCRIPTOR(ts), INTERVAL '1' HOUR))"
        );
        assertEquals(1, features.size());
        assertEquals(LakehouseSqlSupport.LakehouseFeature.WINDOW_TVF, features.get(0));
    }

    @Test
    void detectsAndSoftensUnnestWithOrdinality() {
        String sql = "SELECT * FROM t CROSS JOIN UNNEST(t.arr) WITH ORDINALITY AS u(x, ord)";
        var features = LakehouseSqlSupport.detectHardFeatures(sql);
        assertEquals(1, features.size());
        assertEquals(LakehouseSqlSupport.LakehouseFeature.UNNEST_ORDINALITY, features.get(0));

        LakehouseSqlSupport.SoftenResult softened = LakehouseSqlSupport.softenHardFeatures(sql);
        assertTrue(softened.changed());
        assertTrue(softened.softenedFeatures().contains("UNNEST_ORDINALITY"));
        assertFalse(softened.sql().toUpperCase().contains("ORDINALITY"));
    }
}
