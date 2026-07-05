package org.apache.datawise.backend.common.support;

import java.util.UUID;

public final class IdGenerator {

    private IdGenerator() {
    }

    public static String shortId(String prefix) {
        return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }
}
