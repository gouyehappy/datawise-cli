package org.apache.datawise.backend.connector.ssh;

import org.apache.datawise.backend.model.ConnectionEntity;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SshConnectionSupportTest {

    @Test
    void sshPort_defaultsTo22WhenBlank() {
        ConnectionEntity entity = new ConnectionEntity();
        entity.setPort("");
        assertEquals(22, SshConnectionSupport.sshPort(entity));
    }

    @Test
    void validate_requiresHostUserAndCredential() {
        ConnectionEntity entity = new ConnectionEntity();
        entity.setHost("bastion.example");
        entity.setUsername("ops");
        entity.setPassword("secret");

        assertThrows(SshConnectionException.class, () -> SshConnectionSupport.validate(null));
        assertThrows(SshConnectionException.class, () -> {
            ConnectionEntity missingHost = new ConnectionEntity();
            missingHost.setUsername("ops");
            missingHost.setPassword("secret");
            SshConnectionSupport.validate(missingHost);
        });
    }
}
