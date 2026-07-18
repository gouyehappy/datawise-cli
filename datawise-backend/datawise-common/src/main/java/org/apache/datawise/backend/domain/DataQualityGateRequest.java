package org.apache.datawise.backend.domain;

import java.util.List;

/**
 * Run a suite of {@code data_quality} rules as a release gate.
 * <p>
 * Defaults: when {@code ruleIds} is empty, evaluate rules with {@code blocking=true}
 * in the payload (optionally scoped by connection/database). Set {@code blockingOnly=false}
 * to include every matching DQ rule.
 * <p>
 * Optional {@code referenceConnectionId} (+ {@code referenceDatabase}) runs a second
 * blocking-only suite against another environment; aggregate {@code passed} requires both.
 */
public record DataQualityGateRequest(
        List<String> ruleIds,
        String connectionId,
        String database,
        Boolean blockingOnly,
        String referenceConnectionId,
        String referenceDatabase
) {
}
