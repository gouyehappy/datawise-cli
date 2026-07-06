package org.apache.datawise.backend.common.support;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

public final class IdGenerator {

    private IdGenerator() {
    }

    public static String shortId(String prefix) {
        return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    /** 相同 seed 始终生成相同 id，用于可按业务键定位的持久化记录。 */
    public static String stableShortId(String prefix, String seed) {
        String hash = UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8))
                .toString()
                .replace("-", "");
        return prefix + hash.substring(0, 12);
    }
}
