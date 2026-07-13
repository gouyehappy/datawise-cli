package org.apache.datawise.backend.connector.ssh;

import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import org.apache.datawise.backend.jdbc.ssh.SshJschCompatibility;
import org.apache.datawise.backend.model.ConnectionEntity;

import java.nio.charset.StandardCharsets;

final class SshJschSessions {

    private SshJschSessions() {
    }

    static Session openSession(ConnectionEntity entity, SshClientProperties properties) throws JSchException {
        if (properties.isAllowLegacyAlgorithms()) {
            SshJschCompatibility.applyGlobalDefaults();
        }
        JSch jsch = new JSch();
        if (properties.isStrictHostKeyChecking()) {
            properties.configureKnownHosts(jsch);
        }
        if (entity.getSshPrivateKey() != null && !entity.getSshPrivateKey().isBlank()) {
            byte[] keyBytes = entity.getSshPrivateKey().getBytes(StandardCharsets.UTF_8);
            byte[] passphrase = entity.getSshPassphrase() != null && !entity.getSshPassphrase().isBlank()
                    ? entity.getSshPassphrase().getBytes(StandardCharsets.UTF_8)
                    : null;
            jsch.addIdentity("dw-ssh-key", keyBytes, null, passphrase);
        }
        Session session = jsch.getSession(
                entity.getUsername().trim(),
                entity.getHost().trim(),
                SshConnectionSupport.sshPort(entity)
        );
        if (entity.getPassword() != null && !entity.getPassword().isBlank()) {
            session.setPassword(entity.getPassword());
        }
        session.setConfig("StrictHostKeyChecking", properties.strictHostKeyCheckingMode());
        session.connect(properties.getConnectTimeoutMs());
        properties.persistKnownHosts(jsch);
        return session;
    }
}
