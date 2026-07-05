package org.apache.datawise.backend.ai.domain;

/**
 * 恢复被 interrupt 的分析流水线
 */
public record AiAnalysisResumeRequest(
        String threadId,
        String checkpointId,
        boolean approved
) {
}
