package org.apache.datawise.backend.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SecretValueCodecTest {

    private final SecretValueCodec codec = SecretTestSupport.testCodec();

    @Test
    void encryptsAndDecryptsRoundTrip() {
        String encrypted = codec.encryptForStorage("sk-secret-key");
        assertTrue(codec.isEncrypted(encrypted));
        assertEquals("sk-secret-key", codec.decryptForUse(encrypted));
    }

    @Test
    void leavesPlaintextLegacyValuesReadable() {
        assertEquals("legacy-plain", codec.decryptForUse("legacy-plain"));
        assertFalse(codec.isEncrypted("legacy-plain"));
    }

    @Test
    void doesNotDoubleEncrypt() {
        String once = codec.encryptForStorage("token");
        String twice = codec.encryptForStorage(once);
        assertEquals(once, twice);
    }
}
