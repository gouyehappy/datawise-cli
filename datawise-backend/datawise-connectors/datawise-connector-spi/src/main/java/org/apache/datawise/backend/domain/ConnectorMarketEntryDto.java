package org.apache.datawise.backend.domain;

import java.util.List;

public record ConnectorMarketEntryDto(
        String id,
        String label,
        boolean primary,
        boolean available,
        List<String> capabilities,
        String installHint,
        String version,
        String jarName,
        String integrityStatus,
        String downloadUrl,
        /**
         * True when a plugin JAR exists on disk but the live connector comes from the application
         * classpath (IDE / fat classpath). UI can offer “clean redundant JAR”.
         */
        boolean redundantOnDisk
) {
}
