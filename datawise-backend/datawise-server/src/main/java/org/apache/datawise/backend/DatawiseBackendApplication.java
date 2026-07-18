package org.apache.datawise.backend;

import org.apache.datawise.backend.config.AuthSessionProperties;
import org.apache.datawise.backend.config.ConnectionProbeProperties;
import org.apache.datawise.backend.config.DatawiseConfigProperties;
import org.apache.datawise.backend.config.StorageProperties;
import org.apache.datawise.backend.config.TenancyProperties;
import org.apache.datawise.backend.config.DatawiseQueryProperties;
import org.apache.datawise.backend.config.DatawiseWorkspaceProperties;
import org.apache.datawise.backend.config.SqlRewriteProperties;
import org.apache.datawise.backend.ai.config.AiAnalysisProperties;
import org.apache.datawise.backend.ai.config.AiPythonProperties;
import org.apache.datawise.backend.ai.config.AiRagProperties;
import org.apache.datawise.backend.config.ConnectionLifecycleProperties;
import org.apache.datawise.backend.config.ExplorerSchemaProperties;
import org.apache.datawise.backend.config.JdbcPoolProperties;
import org.apache.datawise.backend.config.TableMigrationProperties;
import org.apache.datawise.backend.connector.ssh.SshClientProperties;
import org.apache.datawise.backend.jdbc.ssh.SshTunnelProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(exclude = {
        DataSourceAutoConfiguration.class,
        FlywayAutoConfiguration.class
})
@EnableScheduling
@EnableConfigurationProperties({
        DatawiseQueryProperties.class,
        SqlRewriteProperties.class,
        DatawiseWorkspaceProperties.class,
        DatawiseConfigProperties.class,
        TenancyProperties.class,
        StorageProperties.class,
        AuthSessionProperties.class,
        ConnectionProbeProperties.class,
        AiRagProperties.class,
        AiAnalysisProperties.class,
        AiPythonProperties.class,
        JdbcPoolProperties.class,
        ConnectionLifecycleProperties.class,
        ExplorerSchemaProperties.class,
        TableMigrationProperties.class,
        SshTunnelProperties.class,
        SshClientProperties.class,
})
public class DatawiseBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(DatawiseBackendApplication.class, args);
    }
}
