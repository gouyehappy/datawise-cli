package org.apache.datawise.backend.connector.ssh;

import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.apache.datawise.backend.connector.operation.ConnectorCatalogOperations;
import org.apache.datawise.backend.connector.operation.ConnectorConnectionOperations;
import org.apache.datawise.backend.domain.ConnectionTestResult;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public class SshConnectorOperations implements ConnectorConnectionOperations, ConnectorCatalogOperations {

    private static final Logger log = LoggerFactory.getLogger(SshConnectorOperations.class);

    private final SshClientProperties sshClientProperties;

    public SshConnectorOperations(SshClientProperties sshClientProperties) {
        this.sshClientProperties = sshClientProperties != null ? sshClientProperties : new SshClientProperties();
    }

    @Override
    public ConnectionTestResult test(ConnectionEntity entity) {
        long start = System.currentTimeMillis();
        try {
            SshConnectionSupport.validate(entity);
            probeSession(entity);
            long latency = System.currentTimeMillis() - start;
            return new ConnectionTestResult(
                    true,
                    String.format(
                            "Connected to SSH %s@%s:%d in %dms",
                            entity.getUsername(),
                            entity.getHost(),
                            SshConnectionSupport.sshPort(entity),
                            latency
                    ),
                    latency
            );
        } catch (Exception ex) {
            ExceptionLogging.warn(
                    log,
                    "SSH connection test failed for " + entity.getHost() + ":" + entity.getPort(),
                    ex
            );
            long latency = System.currentTimeMillis() - start;
            String message = ex instanceof SshConnectionException sshEx
                    ? sshEx.getMessage()
                    : SshConnectionSupport.toUserMessage(ex);
            return new ConnectionTestResult(false, message, latency);
        }
    }

    @Override
    public List<TreeNode> loadConnectionRoot(ConnectionEntity connection, String pattern) {
        return List.of();
    }

    private void probeSession(ConnectionEntity entity) throws SshConnectionException {
        Session session = null;
        try {
            session = SshJschSessions.openSession(entity, sshClientProperties);
        } catch (JSchException ex) {
            throw new SshConnectionException(SshConnectionSupport.toUserMessage(ex), ex);
        } finally {
            if (session != null) {
                session.disconnect();
            }
        }
    }
}
