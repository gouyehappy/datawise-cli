package org.apache.datawise.backend.connector.ssh;

import org.apache.datawise.backend.model.ConnectionEntity;

import java.util.Locale;

public final class SshConnectionSupport {

    private static final int DEFAULT_PORT = 22;

    private SshConnectionSupport() {
    }

    public static void validate(ConnectionEntity entity) throws SshConnectionException {
        if (entity == null) {
            throw new SshConnectionException("Connection is required");
        }
        if (isBlank(entity.getHost())) {
            throw new SshConnectionException("SSH host is required");
        }
        if (isBlank(entity.getUsername())) {
            throw new SshConnectionException("SSH username is required");
        }
        if (isBlank(entity.getPassword()) && isBlank(entity.getSshPrivateKey())) {
            throw new SshConnectionException("SSH password or private key is required");
        }
    }

    public static int sshPort(ConnectionEntity entity) {
        if (entity == null || isBlank(entity.getPort())) {
            return DEFAULT_PORT;
        }
        try {
            int port = Integer.parseInt(entity.getPort().trim());
            return port > 0 && port <= 65535 ? port : DEFAULT_PORT;
        } catch (NumberFormatException ex) {
            return DEFAULT_PORT;
        }
    }

    public static String toUserMessage(Throwable error) {
        String message = rootMessage(error);
        if (message == null || message.isBlank()) {
            return "SSH connection failed";
        }
        String lower = message.toLowerCase(Locale.ROOT);
        if (lower.contains("algorithm negotiation fail")) {
            return "SSH algorithm negotiation failed. The server may require legacy ssh-rsa; ensure datawise.ssh.allow-legacy-algorithms is enabled. Details: " + message;
        }
        if (lower.contains("auth fail") || lower.contains("authentication")) {
            return "SSH authentication failed. Check username, password, or private key.";
        }
        if (lower.contains("connection refused") || lower.contains("connect timed out")) {
            return "Cannot reach SSH server. Check host, port, firewall, and VPN. Details: " + message;
        }
        if (lower.contains("unknownhost") || lower.contains("unknown host")) {
            return "SSH host could not be resolved. Check the hostname. Details: " + message;
        }
        return "SSH connection failed: " + message;
    }

    private static String rootMessage(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current.getMessage() != null && !current.getMessage().isBlank()) {
                return current.getMessage();
            }
            current = current.getCause();
        }
        return null;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
