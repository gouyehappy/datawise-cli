package org.apache.datawise.backend.domain;

import java.util.List;

public record LineageMetaDto(
        String sqlHash,
        String parsedAt,
        String dialect,
        String parser,
        String parserVersion,
        int depth,
        String status,
        List<LineageWarningDto> warnings
) {
}
