package org.apache.datawise.backend.security;

/**
 * Where the AES master key was loaded from.
 */
public enum MasterKeySource {
    /** {@code DATAWISE_MASTER_KEY} environment variable */
    ENV,
    /** Existing {@code config/.datawise-master-key} file */
    FILE,
    /** Newly generated and persisted to the key file */
    GENERATED
}
