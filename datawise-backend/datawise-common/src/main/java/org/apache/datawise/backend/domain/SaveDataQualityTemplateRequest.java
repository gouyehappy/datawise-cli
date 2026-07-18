package org.apache.datawise.backend.domain;

/**
 * Create or update a tenant-shared data-quality rule template.
 */
public record SaveDataQualityTemplateRequest(
        String id,
        String name,
        String description,
        String sql,
        String assertion,
        String expected,
        String column,
        Boolean blocking,
        String cronExpression
) {
}
