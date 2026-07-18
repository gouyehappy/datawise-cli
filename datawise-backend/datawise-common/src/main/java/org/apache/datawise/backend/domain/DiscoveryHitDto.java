package org.apache.datawise.backend.domain;

/**
 * Org-level discovery hit: cached tables/views across visible connections, or semantic metrics.
 */
public record DiscoveryHitDto(
        String kind,
        String id,
        String name,
        String qualifiedLabel,
        String connectionId,
        String connectionLabel,
        String database,
        String owner,
        String subtitle,
        int score
) {
}
