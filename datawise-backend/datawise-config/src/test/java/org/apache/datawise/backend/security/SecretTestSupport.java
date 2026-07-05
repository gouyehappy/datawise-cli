package org.apache.datawise.backend.security;

import javax.crypto.spec.SecretKeySpec;
import java.util.Arrays;

public final class SecretTestSupport {

    private SecretTestSupport() {
    }

    public static SecretValueCodec testCodec() {
        byte[] key = new byte[32];
        Arrays.fill(key, (byte) 9);
        SecretEncryptionService encryptionService = new SecretEncryptionService();
        return new SecretValueCodec(encryptionService, new SecretKeySpec(key, "AES"));
    }
}
