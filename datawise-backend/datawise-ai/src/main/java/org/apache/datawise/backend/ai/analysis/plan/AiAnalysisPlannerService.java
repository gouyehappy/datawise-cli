package org.apache.datawise.backend.ai.analysis.plan;

import org.apache.datawise.backend.ai.domain.AiChatRequest;
import org.apache.datawise.backend.ai.domain.AiDatabaseTargetDto;
import org.apache.datawise.backend.ai.domain.AiAnalysisPlan;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * 根据 prompt 与数据源 scope 生成分析执行计划
 */
@Component
public class AiAnalysisPlannerService {

    private static final Pattern PYTHON_INTENT = Pattern.compile(
            "(预测|回归|相关|相关性|统计检验|显著性|机器学习|拟合|forecast|regression|correlation|"
                    + "machine\\s*learning|scipy|pandas|numpy|python)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    public AiAnalysisPlan baselinePlan(AiChatRequest request) {
        List<AiDatabaseTargetDto> targets = request.targets() != null ? request.targets() : List.of();
        List<String> labels = new ArrayList<>();
        int executable = 0;
        for (AiDatabaseTargetDto target : targets) {
            if (target == null || target.connectionId() == null || target.connectionId().isBlank()) {
                continue;
            }
            executable++;
            labels.add(formatLabel(target));
        }
        boolean federated = executable > 1;
        String mode = federated ? AiAnalysisPlan.MODE_FEDERATED : AiAnalysisPlan.MODE_SQL_ONLY;
        return new AiAnalysisPlan(mode, false, federated, List.copyOf(labels));
    }

    public AiAnalysisPlan plan(AiChatRequest request, String prompt) {
        List<AiDatabaseTargetDto> targets = request.targets() != null ? request.targets() : List.of();
        List<String> labels = new ArrayList<>();
        int executable = 0;
        for (AiDatabaseTargetDto target : targets) {
            if (target == null || target.connectionId() == null || target.connectionId().isBlank()) {
                continue;
            }
            executable++;
            labels.add(formatLabel(target));
        }
        boolean federated = executable > 1;
        boolean requiresPython = PYTHON_INTENT.matcher(prompt != null ? prompt : "").find();
        String mode = federated
                ? AiAnalysisPlan.MODE_FEDERATED
                : (requiresPython ? AiAnalysisPlan.MODE_SQL_THEN_PYTHON : AiAnalysisPlan.MODE_SQL_ONLY);
        return new AiAnalysisPlan(mode, requiresPython, federated, List.copyOf(labels));
    }

    private static String formatLabel(AiDatabaseTargetDto target) {
        StringBuilder builder = new StringBuilder();
        if (target.connectionLabel() != null && !target.connectionLabel().isBlank()) {
            builder.append(target.connectionLabel());
        } else {
            builder.append(target.connectionId());
        }
        String db = target.database() != null && !target.database().isBlank()
                ? target.database()
                : target.databaseLabel();
        if (db != null && !db.isBlank()) {
            builder.append('/').append(db);
        }
        return builder.toString();
    }
}
