package org.apache.datawise.backend.connector.oracle;

import org.apache.datawise.backend.connector.jdbc.JdbcConnectorOperations;
import org.apache.datawise.backend.connector.jdbc.OracleDataSourceConnector;
import org.apache.datawise.backend.connector.oracle.ops.OracleFamilyDatabaseOps;
import org.apache.datawise.backend.connector.oracle.schema.OracleSchemaDialect;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@ConditionalOnClass(name = "oracle.jdbc.OracleDriver")
public class OracleConnectorAutoConfiguration {

    @Bean
    OracleSchemaDialect oracleSchemaDialect() {
        return new OracleSchemaDialect();
    }

    @Bean
    OracleFamilyDatabaseOps oracleFamilyDatabaseOps() {
        return new OracleFamilyDatabaseOps();
    }

    @Bean
    OracleDataSourceConnector oracleDataSourceConnector(JdbcConnectorOperations jdbc) {
        return new OracleDataSourceConnector(jdbc);
    }
}
