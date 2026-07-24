package org.apache.datawise.desktop.bridge;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DesktopBridgeScriptTest {
    @Test
    void omitsTerminalAndExposesCoreFields() {
        String script = DesktopBridgeScript.build("win32", "http://127.0.0.1:18421", "4.0.1", false);
        assertTrue(script.contains("__datawiseDesktopBridge"));
        assertTrue(script.contains("apiBaseUrl"));
        assertTrue(script.contains("cefQuery"));
        assertTrue(script.contains("isPackaged"));
        assertFalse(script.contains("splash:"));
        assertFalse(script.contains("terminal:"));
        assertFalse(script.contains("terminal: {"));
    }
}
