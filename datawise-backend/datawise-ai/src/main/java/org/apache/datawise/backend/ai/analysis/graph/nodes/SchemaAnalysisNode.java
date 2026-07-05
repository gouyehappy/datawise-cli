package org.apache.datawise.backend.ai.analysis.graph.nodes;

import com.alibaba.cloud.ai.graph.OverAllState;
import org.apache.datawise.backend.ai.analysis.AiAnalysisSteps;
import org.apache.datawise.backend.ai.analysis.graph.state.AiAnalysisGraphKeys;
import org.apache.datawise.backend.ai.analysis.graph.state.AiAnalysisGraphStateCoercion;
import org.apache.datawise.backend.ai.analysis.graph.support.AnalysisStepRunner;
import org.apache.datawise.backend.ai.schema.AiSchemaContextService;
import org.apache.datawise.backend.ai.support.AiCallLogger;
import org.apache.datawise.backend.ai.schema.AiSqlSchemaContext;
import org.apache.datawise.backend.ai.domain.AiEvidenceBundle;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 步骤 3/8：加载候选表 DDL，写入 SCHEMA 供 SQL 生成使用。
 */
@Component
public class SchemaAnalysisNode {

    private static final Logger log = LoggerFactory.getLogger(SchemaAnalysisNode.class);

    private final AiSchemaContextService aiSchemaContextService;

    public SchemaAnalysisNode(AiSchemaContextService aiSchemaContextService) {
        this.aiSchemaContextService = aiSchemaContextService;
    }

    public Map<String, Object> execute(OverAllState state) {
        return AnalysisNodeSupport.runWithUserContext(state, () -> executeInternal(state));
    }

    private Map<String, Object> executeInternal(OverAllState state) {
        AnalysisNodeSupport.ConnectionScope scope = AnalysisNodeSupport.readConnectionScope(state);
        AiEvidenceBundle evidence = AiAnalysisGraphStateCoercion.evidence(state, scope.prompt());
        long stepStart = AnalysisStepRunner.start();

        AnalysisStepRunner.running(AiAnalysisSteps.SCHEMA, "加载表结构与 DDL");
        AiSqlSchemaContext schema = aiSchemaContextService.build(
                scope.connectionId(), scope.database(), scope.prompt(), evidence
        );

        Map<String, Object> schemaDetail = new LinkedHashMap<>();
        schemaDetail.put("tableCount", schema.tables() != null ? schema.tables().size() : 0);
        schemaDetail.put("ddlCount", schema.tableDdls() != null ? schema.tableDdls().size() : 0);
        schemaDetail.put("relationCount", schema.tableRelations() != null ? schema.tableRelations().size() : 0);
        AnalysisStepRunner.ok(AiAnalysisSteps.SCHEMA, "Schema 已加载", stepStart, schemaDetail);
        AiCallLogger.logAnalysisStep(log, "schema", "tables", schemaDetail.get("tableCount"), "ddls", schemaDetail.get("ddlCount"));

        return Map.of(AiAnalysisGraphKeys.SCHEMA, schema);
    }
}
