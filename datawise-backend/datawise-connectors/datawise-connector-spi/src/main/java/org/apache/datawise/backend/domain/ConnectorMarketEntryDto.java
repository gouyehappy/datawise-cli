package org.apache.datawise.backend.domain;

import java.util.List;

public record ConnectorMarketEntryDto(
        String id,
        String label,
        boolean primary,
        boolean available,
        List<String> capabilities,
        String installHint
) {
}
