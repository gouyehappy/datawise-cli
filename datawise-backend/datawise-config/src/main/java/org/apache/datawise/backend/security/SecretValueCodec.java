package org.apache.datawise.backend.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;

/**
 * 配置文件中的敏感字段编解码。
 * 存储格式：{@code dwenc:v1:<base64(iv+ciphertext)>}
 */
@Service
public class SecretValueCodec {

    public static final String PREFIX = "dwenc:v1:";

    private final SecretEncryptionService encryptionService;
    private final SecretKey secretKey;

    @Autowired
    public SecretValueCodec(SecretEncryptionService encryptionService, MasterKeyService masterKeyService) {
        this.encryptionService = encryptionService;
        this.secretKey = masterKeyService.secretKey();
    }

    SecretValueCodec(SecretEncryptionService encryptionService, SecretKey secretKey) {
        this.encryptionService = encryptionService;
        this.secretKey = secretKey;
    }

    public boolean isEncrypted(String value) {
        return value != null && value.startsWith(PREFIX);
    }

    /**
     * 落盘前加密；已是密文或空值则原样返回
     */
    public String encryptForStorage(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            return plaintext;
        }
        if (isEncrypted(plaintext)) {
            return plaintext;
        }
        return PREFIX + encryptionService.encrypt(plaintext, secretKey);
    }

    /**
     * 读取后解密；明文旧数据兼容直接返回
     */
    public String decryptForUse(String stored) {
        if (stored == null || stored.isBlank()) {
            return stored;
        }
        if (!isEncrypted(stored)) {
            return stored;
        }
        return encryptionService.decrypt(stored.substring(PREFIX.length()), secretKey);
    }
}
