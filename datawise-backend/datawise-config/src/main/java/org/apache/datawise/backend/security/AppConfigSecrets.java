package org.apache.datawise.backend.security;

import java.util.List;
import java.util.Map;

/**
 * app.xml 中 AI LLM apiKey 字段加解密
 */
public final class AppConfigSecrets {

    private static final String AI_SECTION = "ai";
    private static final String LLM_PROFILES = "llmProfiles";
    private static final String EMBEDDING_PROFILES = "embeddingProfiles";
    private static final String EMBEDDING = "embedding";
    private static final String LEGACY_LLM = "llm";
    private static final String API_KEY = "apiKey";
    private static final String RAG_SECTION = "rag";
    private static final String PGVECTOR = "pgvector";
    private static final String PASSWORD = "password";

    private AppConfigSecrets() {
    }

    @SuppressWarnings("unchecked")
    public static void decryptAiSection(Map<String, Object> config, SecretValueCodec codec) {
        if (config == null) {
            return;
        }
        Object aiRaw = config.get(AI_SECTION);
        if (!(aiRaw instanceof Map<?, ?> ai)) {
            return;
        }
        decryptProfiles((List<Map<String, Object>>) ai.get(LLM_PROFILES), codec);
        decryptProfiles((List<Map<String, Object>>) ai.get(EMBEDDING_PROFILES), codec);
        Object embedding = ai.get(EMBEDDING);
        if (embedding instanceof Map<?, ?> embeddingMap) {
            decryptApiKey((Map<String, Object>) embeddingMap, codec);
        }
        Object legacy = ai.get(LEGACY_LLM);
        if (legacy instanceof Map<?, ?> legacyMap) {
            decryptApiKey((Map<String, Object>) legacyMap, codec);
        }
        decryptRagPgPassword((Map<String, Object>) ai.get(RAG_SECTION), codec);
    }

    @SuppressWarnings("unchecked")
    public static void encryptAiSection(Map<String, Object> config, SecretValueCodec codec) {
        if (config == null) {
            return;
        }
        Object aiRaw = config.get(AI_SECTION);
        if (!(aiRaw instanceof Map<?, ?> ai)) {
            return;
        }
        encryptProfiles((List<Map<String, Object>>) ai.get(LLM_PROFILES), codec);
        encryptProfiles((List<Map<String, Object>>) ai.get(EMBEDDING_PROFILES), codec);
        Object embedding = ai.get(EMBEDDING);
        if (embedding instanceof Map<?, ?> embeddingMap) {
            encryptApiKey((Map<String, Object>) embeddingMap, codec);
        }
        Object legacy = ai.get(LEGACY_LLM);
        if (legacy instanceof Map<?, ?> legacyMap) {
            encryptApiKey((Map<String, Object>) legacyMap, codec);
        }
        encryptRagPgPassword((Map<String, Object>) ai.get(RAG_SECTION), codec);
    }

    private static void decryptProfiles(List<Map<String, Object>> profiles, SecretValueCodec codec) {
        if (profiles == null) {
            return;
        }
        for (Map<String, Object> profile : profiles) {
            decryptApiKey(profile, codec);
        }
    }

    private static void encryptProfiles(List<Map<String, Object>> profiles, SecretValueCodec codec) {
        if (profiles == null) {
            return;
        }
        for (Map<String, Object> profile : profiles) {
            encryptApiKey(profile, codec);
        }
    }

    private static void decryptApiKey(Map<String, Object> profile, SecretValueCodec codec) {
        if (profile == null || !(profile.get(API_KEY) instanceof String apiKey)) {
            return;
        }
        profile.put(API_KEY, codec.decryptForUse(apiKey));
    }

    private static void encryptApiKey(Map<String, Object> profile, SecretValueCodec codec) {
        if (profile == null || !(profile.get(API_KEY) instanceof String apiKey)) {
            return;
        }
        profile.put(API_KEY, codec.encryptForStorage(apiKey));
    }

    /**
     * 统计仍为明文的 apiKey 数量（非空且未加密）
     */
    @SuppressWarnings("unchecked")
    public static int countPlaintextApiKeys(Map<String, Object> config, SecretValueCodec codec) {
        if (config == null) {
            return 0;
        }
        Object aiRaw = config.get(AI_SECTION);
        if (!(aiRaw instanceof Map<?, ?> ai)) {
            return 0;
        }
        int count = countPlaintextInProfiles((List<Map<String, Object>>) ai.get(LLM_PROFILES), codec);
        count += countPlaintextInProfiles((List<Map<String, Object>>) ai.get(EMBEDDING_PROFILES), codec);
        Object embedding = ai.get(EMBEDDING);
        if (embedding instanceof Map<?, ?> embeddingMap) {
            count += isPlaintextApiKey((Map<String, Object>) embeddingMap, codec) ? 1 : 0;
        }
        Object legacy = ai.get(LEGACY_LLM);
        if (legacy instanceof Map<?, ?> legacyMap) {
            count += isPlaintextApiKey((Map<String, Object>) legacyMap, codec) ? 1 : 0;
        }
        count += countPlaintextRagPgPassword((Map<String, Object>) ai.get(RAG_SECTION), codec);
        return count;
    }

    @SuppressWarnings("unchecked")
    private static void decryptRagPgPassword(Map<String, Object> rag, SecretValueCodec codec) {
        if (rag == null) {
            return;
        }
        Object pgRaw = rag.get(PGVECTOR);
        if (pgRaw instanceof Map<?, ?> pgMap) {
            decryptPassword((Map<String, Object>) pgMap, codec);
        }
    }

    @SuppressWarnings("unchecked")
    private static void encryptRagPgPassword(Map<String, Object> rag, SecretValueCodec codec) {
        if (rag == null) {
            return;
        }
        Object pgRaw = rag.get(PGVECTOR);
        if (pgRaw instanceof Map<?, ?> pgMap) {
            encryptPassword((Map<String, Object>) pgMap, codec);
        }
    }

    private static int countPlaintextRagPgPassword(Map<String, Object> rag, SecretValueCodec codec) {
        if (rag == null) {
            return 0;
        }
        Object pgRaw = rag.get(PGVECTOR);
        if (pgRaw instanceof Map<?, ?> pgMap) {
            return isPlaintextPassword((Map<String, Object>) pgMap, codec) ? 1 : 0;
        }
        return 0;
    }

    private static void decryptPassword(Map<String, Object> profile, SecretValueCodec codec) {
        if (profile == null || !(profile.get(PASSWORD) instanceof String password)) {
            return;
        }
        profile.put(PASSWORD, codec.decryptForUse(password));
    }

    private static void encryptPassword(Map<String, Object> profile, SecretValueCodec codec) {
        if (profile == null || !(profile.get(PASSWORD) instanceof String password)) {
            return;
        }
        profile.put(PASSWORD, codec.encryptForStorage(password));
    }

    private static boolean isPlaintextPassword(Map<String, Object> profile, SecretValueCodec codec) {
        if (profile == null || !(profile.get(PASSWORD) instanceof String password)) {
            return false;
        }
        return !password.isBlank() && !codec.isEncrypted(password);
    }

    private static int countPlaintextInProfiles(List<Map<String, Object>> profiles, SecretValueCodec codec) {
        if (profiles == null) {
            return 0;
        }
        int count = 0;
        for (Map<String, Object> profile : profiles) {
            if (isPlaintextApiKey(profile, codec)) {
                count += 1;
            }
        }
        return count;
    }

    private static boolean isPlaintextApiKey(Map<String, Object> profile, SecretValueCodec codec) {
        if (profile == null || !(profile.get(API_KEY) instanceof String apiKey)) {
            return false;
        }
        return !apiKey.isBlank() && !codec.isEncrypted(apiKey);
    }
}
