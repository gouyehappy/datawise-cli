package org.apache.datawise.backend.ai.schema;

import org.apache.datawise.backend.ai.domain.AiEvidenceBundle;
import org.apache.datawise.backend.ai.tag.AiTableTagService;
import org.apache.datawise.backend.configstore.SemanticMetricStore;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.model.SemanticMetricEntry;
import org.apache.datawise.backend.database.context.ConnectionExecutionContext;
import org.apache.datawise.backend.database.context.ConnectionExecutionContext.ResolvedConnectionWithDatabase;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AiSchemaContextService {

    private final ConnectionExecutionContext connectionContext;
    private final AiSchemaJdbcMetadata jdbcMetadata;
    private final AiSchemaDdlLoader ddlLoader;
    private final AiTableRelationService tableRelationService;
    private final AiTableTagService tableTagService;
    private final SemanticMetricStore semanticMetricStore;

    public AiSchemaContextService(
            ConnectionExecutionContext connectionContext,
            AiSchemaJdbcMetadata jdbcMetadata,
            AiSchemaDdlLoader ddlLoader,
            AiTableRelationService tableRelationService,
            AiTableTagService tableTagService,
            SemanticMetricStore semanticMetricStore
    ) {
        this.connectionContext = connectionContext;
        this.jdbcMetadata = jdbcMetadata;
        this.ddlLoader = ddlLoader;
        this.tableRelationService = tableRelationService;
        this.tableTagService = tableTagService;
        this.semanticMetricStore = semanticMetricStore;
    }

    public AiSqlSchemaContext build(String connectionId, String database, String prompt) {
        return build(connectionId, database, prompt, null);
    }

    public List<String> listTableNames(String connectionId, String database) {
        ResolvedConnectionWithDatabase resolved = resolveScope(connectionId, database);
        List<String> allTables = jdbcMetadata.listTables(resolved.entity(), resolved.database());
        return tableTagService.filterTaggedTables(connectionId, resolved.database(), allTables);
    }

    public AiSqlSchemaContext build(
            String connectionId,
            String database,
            String prompt,
            AiEvidenceBundle evidence
    ) {
        ResolvedConnectionWithDatabase resolved = resolveScope(connectionId, database);
        ConnectionEntity entity = resolved.entity();
        String resolvedDatabase = resolved.database();

        List<String> tables = listTableNames(connectionId, resolvedDatabase);
        List<String> relevantTables = AiSchemaTablePicker.pickRelevantTables(prompt, tables, evidence);
        List<AiTableDdlSnippet> ddls = ddlLoader.loadSnippets(entity.getId(), resolvedDatabase, relevantTables);

        return new AiSqlSchemaContext(
                entity.getName(),
                resolvedDatabase,
                entity.getDbType(),
                tables,
                ddls,
                tableRelationService.loadRelations(entity.getId(), resolvedDatabase, relevantTables),
                loadSemanticMetrics(connectionId, resolvedDatabase)
        );
    }

    public AiSqlSchemaContext buildForTables(
            String connectionId,
            String database,
            List<String> tableNames,
            AiEvidenceBundle evidence
    ) {
        ResolvedConnectionWithDatabase resolved = resolveScope(connectionId, database);
        ConnectionEntity entity = resolved.entity();
        String resolvedDatabase = resolved.database();

        List<String> allTables = listTableNames(connectionId, resolvedDatabase);
        List<String> resolvedNames = AiSchemaTablePicker.resolveTableNames(tableNames, allTables, evidence);
        List<AiTableDdlSnippet> ddls = ddlLoader.loadSnippets(entity.getId(), resolvedDatabase, resolvedNames);

        return new AiSqlSchemaContext(
                entity.getName(),
                resolvedDatabase,
                entity.getDbType(),
                allTables,
                ddls,
                tableRelationService.loadRelations(entity.getId(), resolvedDatabase, resolvedNames),
                loadSemanticMetrics(connectionId, resolvedDatabase)
        );
    }

    private List<AiSemanticMetricHint> loadSemanticMetrics(String connectionId, String database) {
        if (connectionId == null || connectionId.isBlank() || database == null || database.isBlank()) {
            return List.of();
        }
        return semanticMetricStore.listScoped(connectionId, database).stream()
                .map(this::toMetricHint)
                .toList();
    }

    private AiSemanticMetricHint toMetricHint(SemanticMetricEntry entry) {
        return new AiSemanticMetricHint(
                entry.getName(),
                entry.getExpression(),
                entry.getDescription(),
                entry.getUnit()
        );
    }

    private ResolvedConnectionWithDatabase resolveScope(String connectionId, String database) {
        return connectionContext.requireAvailableWithDatabaseForCurrentUser(
                connectionId,
                database,
                ConnectionExecutionContext.DEFAULT_CONNECTION_NOT_FOUND
        );
    }
}
