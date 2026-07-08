package org.apache.datawise.backend.lineage.model;

import java.util.List;

public record LineageParseResult(
        List<ColumnLineage> columns,
        List<LineageWarning> warnings,
        ParseStatus status,
        String engineId,
        String engineVersion
) {
    public static LineageParseResult failed(String engineId, String engineVersion, String message) {
        return new LineageParseResult(
                List.of(),
                List.of(LineageWarning.of("PARSER_FAILED", message)),
                ParseStatus.FAILED,
                engineId,
                engineVersion
        );
    }
}
