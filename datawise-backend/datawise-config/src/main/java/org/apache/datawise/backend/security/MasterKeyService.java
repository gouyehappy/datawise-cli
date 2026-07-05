package org.apache.datawise.backend.security;

import org.apache.datawise.backend.configstore.ConfigDirectoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 本地主密钥：优先 {@code DATAWISE_MASTER_KEY} 环境变量，否则 {@code config/.datawise-master-key}。
 */
@Service
public class MasterKeyService {

    public static final String MASTER_KEY_ENV = "DATAWISE_MASTER_KEY";
    public static final String MASTER_KEY_FILE = ".datawise-master-key";

    private final SecretKey secretKey;

    @Autowired
    public MasterKeyService(ConfigDirectoryService configDirectory) {
        this.secretKey = loadOrCreate(configDirectory);
    }

    /**
     * 测试用：固定密钥
     */
    MasterKeyService(byte[] rawKey) {
        this.secretKey = toSecretKey(rawKey);
    }

    public SecretKey secretKey() {
        return secretKey;
    }

    private static SecretKey loadOrCreate(ConfigDirectoryService configDirectory) {
        String env = System.getenv(MASTER_KEY_ENV);
        if (env != null && !env.isBlank()) {
            return toSecretKey(decodeKey(env.trim()));
        }
        Path keyPath = configDirectory.resolve(MASTER_KEY_FILE);
        if (Files.isRegularFile(keyPath)) {
            try {
                String encoded = Files.readString(keyPath, StandardCharsets.UTF_8).trim();
                return toSecretKey(decodeKey(encoded));
            } catch (IOException ex) {
                throw new IllegalStateException("Failed to read " + MASTER_KEY_FILE, ex);
            }
        }
        return createAndPersist(configDirectory, keyPath);
    }

    private static SecretKey createAndPersist(ConfigDirectoryService configDirectory, Path keyPath) {
        byte[] raw = new byte[32];
        new SecureRandom().nextBytes(raw);
        try {
            configDirectory.ensureExists();
            Files.writeString(keyPath, Base64.getEncoder().encodeToString(raw), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to create " + MASTER_KEY_FILE, ex);
        }
        return toSecretKey(raw);
    }

    private static byte[] decodeKey(String encoded) {
        byte[] raw = Base64.getDecoder().decode(encoded);
        if (raw.length != 32) {
            throw new IllegalStateException("Master key must be 32 bytes (AES-256), got " + raw.length);
        }
        return raw;
    }

    private static SecretKey toSecretKey(byte[] raw) {
        if (raw.length != 32) {
            throw new IllegalArgumentException("Master key must be 32 bytes");
        }
        return new SecretKeySpec(raw, "AES");
    }
}
