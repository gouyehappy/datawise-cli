package org.apache.datawise.backend.ai.domain;

public record AiSqlGenerateRequest(
        String prompt,
        String connectionId,
        String database,
        AiLlmProfileDto llm
) {
}
