package org.apache.datawise.backend.ai.analysis.graph.checkpoint;

import com.alibaba.cloud.ai.graph.OverAllState;
import com.alibaba.cloud.ai.graph.serializer.plain_text.gson.GsonStateSerializer;
import org.apache.datawise.backend.ai.analysis.graph.state.AiAnalysisGraphStateFactory;

import java.util.Map;

/**
 * StateGraph checkpoint 序列化（Gson + 分析图 state factory）
 */
public final class AiAnalysisGsonStateSerializer extends GsonStateSerializer {

    public AiAnalysisGsonStateSerializer() {
        super((Map<String, Object> data) -> restoreState(data));
    }

    private static OverAllState restoreState(Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return new AiAnalysisGraphStateFactory().create();
        }
        return AiAnalysisGraphStateFactory.fromCheckpointData(data);
    }
}
