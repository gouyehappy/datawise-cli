package org.apache.datawise.backend.jdbc.ssh;

import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Files;
import java.nio.file.Path;

final class SshKnownHostsSupport {

    private static final Logger log = LoggerFactory.getLogger(SshKnownHostsSupport.class);

    private SshKnownHostsSupport() {
    }

    static void configureKnownHosts(JSch jsch, SshTunnelProperties properties) throws JSchException {
        Path path = resolveKnownHostsPath(properties);
        try {
            Path parent = path.getParent();
            if (parent != null && !Files.exists(parent)) {
                Files.createDirectories(parent);
            }
            if (!Files.exists(path)) {
                Files.createFile(path);
            }
            jsch.setKnownHosts(path.toString());
        } catch (Exception ex) {
            throw new JSchException("Failed to load SSH known_hosts from " + path + ": " + ex.getMessage(), ex);
        }
    }

    static void persistKnownHosts(JSch jsch, SshTunnelProperties properties) {
        if (!properties.isStrictHostKeyChecking() || !properties.isAcceptNewHostKeys()) {
            return;
        }
        try {
            jsch.setKnownHosts(resolveKnownHostsPath(properties).toString());
        } catch (JSchException ex) {
            log.warn("Failed to persist SSH known_hosts: {}", ex.getMessage());
        }
    }

    static String strictHostKeyCheckingMode(SshTunnelProperties properties) {
        if (!properties.isStrictHostKeyChecking()) {
            return "no";
        }
        return properties.isAcceptNewHostKeys() ? "accept-new" : "yes";
    }

    private static Path resolveKnownHostsPath(SshTunnelProperties properties) {
        if (properties.getKnownHostsPath() != null && !properties.getKnownHostsPath().isBlank()) {
            return Path.of(properties.getKnownHostsPath().trim());
        }
        String configDir = System.getenv("DATAWISE_CONFIG_DIR");
        if (configDir == null || configDir.isBlank()) {
            configDir = "config";
        }
        return Path.of(configDir.trim(), "ssh-known-hosts");
    }
}
