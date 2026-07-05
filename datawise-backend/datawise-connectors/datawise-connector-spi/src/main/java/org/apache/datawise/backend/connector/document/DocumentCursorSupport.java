package org.apache.datawise.backend.connector.document;

import org.apache.datawise.backend.common.TableDataException;

/** Shared cursor id format for document-store table data pagination. */
public final class DocumentCursorSupport {

    public static final String OFFSET_PREFIX = "mongo-offset:";

    private DocumentCursorSupport() {
    }

    public static boolean isOffsetCursor(String cursorId) {
        return cursorId != null && cursorId.startsWith(OFFSET_PREFIX);
    }

    public static int parseOffset(String cursorId) {
        if (!isOffsetCursor(cursorId)) {
            throw new TableDataException("Invalid document table data cursor", TableDataException.FETCH_FAILED);
        }
        try {
            return Integer.parseInt(cursorId.substring(OFFSET_PREFIX.length()));
        } catch (NumberFormatException ex) {
            throw new TableDataException("Invalid document table data cursor", TableDataException.FETCH_FAILED, ex);
        }
    }
}
