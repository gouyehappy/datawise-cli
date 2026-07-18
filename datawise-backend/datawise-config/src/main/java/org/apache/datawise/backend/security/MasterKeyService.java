package org.apache.datawise.backend.security;

import org.apache.datawise.backend.common.support.RestrictiveFilePermissions;
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
 * <p>
 * Multi-node / hosted deployments should inject {@link #MASTER_KEY_ENV} (or mount the same key file)
 * so ciphertext stays portable across machines.
 */
@Service
public class MasterKeyService {

    public static final String MASTER_KEY_ENV = "DATAWISE_MASTER_KEY";
    public static final String MASTER_KEY_FILE = ".datawise-master-key";

    private final SecretKey secretKey;
    private final MasterKeySource source;

    @Autowired
    public MasterKeyService(ConfigDirectoryService configDirectory) {
        LoadedKey loaded = loadOrCreate(configDirectory);
        this.secretKey = loaded.key();
        this.source = loaded.source();
    }

    /**
     * 测试用：固定密钥
     */
    MasterKeyService(byte[] rawKey) {
        this.secretKey = toSecretKey(rawKey);
        this.source = MasterKeySource.ENV;
    }

    public SecretKey secretKey() {
        return secretKey;
    }

    public MasterKeySource source() {
        return source;
    }

    private static LoadedKey loadOrCreate(ConfigDirectoryService configDirectory) {
        String env = System.getenv(MASTER_KEY_ENV);
        if (env != null && !env.isBlank()) {
            return new LoadedKey(toSecretKey(decodeKey(env.trim())), MasterKeySource.ENV);
        }
        Path keyPath = configDirectory.resolve(MASTER_KEY_FILE);
        if (Files.isRegularFile(keyPath)) {
            try {
                String encoded = Files.readString(keyPath, StandardCharsets.UTF_8).trim();
                return new LoadedKey(toSecretKey(decodeKey(encoded)), MasterKeySource.FILE);
            } catch (IOException ex) {
                throw new IllegalStateException("Failed to read " + MASTER_KEY_FILE, ex);
            }
        }
        return new LoadedKey(createAndPersist(configDirectory, keyPath), MasterKeySource.GENERATED);
    }

    private static SecretKey createAndPersist(ConfigDirectoryService configDirectory, Path keyPath) {
        byte[] raw = new byte[32];
        new SecureRandom().nextBytes(raw);
        try {
            configDirectory.ensureExists();
            Files.writeString(keyPath, Base64.getEncoder().encodeToString(raw), StandardCharsets.UTF_8);
            RestrictiveFilePermissions.applyOwnerOnly(keyPath);
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

    private record LoadedKey(SecretKey key, MasterKeySource source) {
    }
}
