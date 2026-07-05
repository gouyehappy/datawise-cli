package org.apache.datawise.backend.connector.jdbc;

import org.apache.datawise.backend.connector.spi.ConnectorJdbcOperations;

import java.util.Set;

public class ElasticsearchDataSourceConnector extends AbstractJdbcDataSourceConnector {

    public ElasticsearchDataSourceConnector(ConnectorJdbcOperations jdbc) {
        super("jdbc-elasticsearch", 21, Set.of("elasticsearch"), jdbc);
    }
}
