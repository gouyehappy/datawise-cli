package org.apache.datawise.backend.ai.analysis.graph.runtime;

import org.apache.datawise.backend.ai.domain.AiAnalysisStepEvent;

import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * 图节点内发射 SSE 步骤事件（ThreadLocal，避免写入 OverAllState）
 */
public final class AiAnalysisStepContext {

    private static final ThreadLocal<Consumer<AiAnalysisStepEvent>> ON_STEP = new ThreadLocal<>();

    private AiAnalysisStepContext() {
    }

    public static <T> T runWith(Consumer<AiAnalysisStepEvent> onStep, Supplier<T> task) {
        ON_STEP.set(onStep);
        try {
            return task.get();
        } finally {
            ON_STEP.remove();
        }
    }

    public static void emit(AiAnalysisStepEvent event) {
        Consumer<AiAnalysisStepEvent> handler = ON_STEP.get();
        if (handler != null) {
            handler.accept(event);
        }
    }
}
