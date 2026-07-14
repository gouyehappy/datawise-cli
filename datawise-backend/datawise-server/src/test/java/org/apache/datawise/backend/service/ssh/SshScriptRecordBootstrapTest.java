package org.apache.datawise.backend.service.ssh;

import org.apache.datawise.backend.model.SshScriptRecord;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SshScriptRecordBootstrapTest {

    @Test
    void seedsBuiltInsOnlyWhenStoreIsEmpty() {
        List<SshScriptRecord> seeded = SshScriptRecordBootstrap.ensureDefaults(List.of(), 1L);
        assertTrue(seeded.size() >= 4);
        assertTrue(seeded.stream().anyMatch(record -> "builtin-logs".equals(record.getId())));
    }

    @Test
    void doesNotReseedDeletedBuiltIns() {
        SshScriptRecord custom = new SshScriptRecord("custom-1", "Custom", "<pre>echo hi</pre>", 1L);
        List<SshScriptRecord> ensured = SshScriptRecordBootstrap.ensureDefaults(List.of(custom), 2L);
        assertEquals(1, ensured.size());
        assertEquals("custom-1", ensured.get(0).getId());
    }

    @Test
    void repairsBlankBuiltinContentInPlace() {
        SshScriptRecord blank = new SshScriptRecord("builtin-status", "状态", "", 1L);
        List<SshScriptRecord> ensured = SshScriptRecordBootstrap.ensureDefaults(List.of(blank), 2L);
        assertEquals(1, ensured.size());
        assertEquals("builtin-status", ensured.get(0).getId());
        assertTrue(ensured.get(0).getContentHtml() != null && !ensured.get(0).getContentHtml().isBlank());
        assertTrue(ensured.get(0).getContentHtml().contains("uptime"));
    }
}
