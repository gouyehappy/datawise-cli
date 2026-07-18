package org.apache.datawise.backend.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;

/**
 * 配置文件中的敏感字段编解码。
 * <p>
 * 存储格式：
 * <ul>
 *   <li>{@code dwenc:v1:<base64(iv+ciphertext)>} — AES-GCM with local master key</li>
 *   <li>{@code dwsecret:env:NAME} / {@code dwsecret:file:path} — external secret reference (G5)</li>
 * </ul>
 */
@Service
public class SecretValueCodec {

    public static final String PREFIX = "dwenc:v1:";

    private final SecretEncryptionService encryptionService;
    private final SecretKey secretKey;
    private final SecretReferenceResolver referenceResolver;

    @Autowired
    public SecretValueCodec(
            SecretEncryptionService encryptionService,
            MasterKeyService masterKeyService,
            SecretReferenceResolver referenceResolver
    ) {
        this.encryptionService = encryptionService;
        this.secretKey = masterKeyService.secretKey();
        this.referenceResolver = referenceResolver;
    }

    SecretValueCodec(SecretEncryptionService encryptionService, SecretKey secretKey) {
        this(encryptionService, secretKey, null);
    }

    SecretValueCodec(
            SecretEncryptionService encryptionService,
            SecretKey secretKey,
            SecretReferenceResolver referenceResolver
    ) {
        this.encryptionService = encryptionService;
        this.secretKey = secretKey;
        this.referenceResolver = referenceResolver;
    }

    public boolean isEncrypted(String value) {
        return value != null && value.startsWith(PREFIX);
    }

    public boolean isSecretReference(String value) {
        return referenceResolver != null && referenceResolver.isReference(value);
    }

    /**
     * 落盘前加密；已是密文、外部引用或空值则原样返回
     */
    public String encryptForStorage(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            return plaintext;
        }
        if (isEncrypted(plaintext) || isSecretReference(plaintext)) {
            return plaintext;
        }
        return PREFIX + encryptionService.encrypt(plaintext, secretKey);
    }

    /**
     * 读取后解密 / 解析引用；明文旧数据兼容直接返回
     */
    public String decryptForUse(String stored) {
        if (stored == null || stored.isBlank()) {
            return stored;
        }
        if (isSecretReference(stored)) {
            return referenceResolver.resolve(stored);
        }
        if (!isEncrypted(stored)) {
            return stored;
        }
        return encryptionService.decrypt(stored.substring(PREFIX.length()), secretKey);
    }
}
