package org.apache.datawise.backend.common.support;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Set;

/** Best-effort owner-only permissions for secret files on POSIX filesystems. */
public final class RestrictiveFilePermissions {

    private static final Logger log = LoggerFactory.getLogger(RestrictiveFilePermissions.class);
    private static final Set<PosixFilePermission> OWNER_READ_WRITE_ONLY = PosixFilePermissions.fromString("rw-------");

    private RestrictiveFilePermissions() {
    }

    public static void applyOwnerOnly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.setPosixFilePermissions(path, OWNER_READ_WRITE_ONLY);
        } catch (UnsupportedOperationException ex) {
            // Windows and some network filesystems do not support POSIX permissions.
        } catch (IOException ex) {
            log.warn("Failed to set restrictive permissions on {}: {}", path, ex.getMessage());
        }
    }
}
