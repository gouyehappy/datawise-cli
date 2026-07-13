package org.apache.datawise.backend.connector.ssh;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;

@AutoConfiguration
@EnableScheduling
@EnableConfigurationProperties(SshClientProperties.class)
public class SshConnectorAutoConfiguration {

    @Bean
    SshConnectorOperations sshConnectorOperations(SshClientProperties properties) {
        return new SshConnectorOperations(properties);
    }

    @Bean
    SshDataSourceConnector sshDataSourceConnector(SshConnectorOperations ssh) {
        return new SshDataSourceConnector(ssh);
    }

    @Bean
    SshShellSessionManager sshShellSessionManager(SshClientProperties properties) {
        return new SshShellSessionManager(properties);
    }
}
