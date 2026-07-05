package org.apache.datawise.backend.connector.facade;

import org.apache.datawise.backend.connector.ConnectorPluginContributionHolder;
import org.apache.datawise.backend.connector.facade.catalog.ConnectorCatalogAccess;
import org.apache.datawise.backend.connector.facade.ddl.ConnectorDdlAccess;
import org.apache.datawise.backend.connector.facade.document.ConnectorDocumentAccess;
import org.apache.datawise.backend.connector.facade.dml.ConnectorDmlAccess;
import org.apache.datawise.backend.connector.facade.jdbc.ConnectorJdbcAccess;
import org.apache.datawise.backend.connector.facade.jdbc.ConnectorJdbcSessionAccess;
import org.apache.datawise.backend.connector.facade.messagebroker.ConnectorMessageBrokerAccess;
import org.apache.datawise.backend.connector.facade.nativecmd.ConnectorNativeAccess;
import org.apache.datawise.backend.connector.facade.ops.ConnectorOpsAccess;
import org.apache.datawise.backend.connector.facade.schema.ConnectorSchemaAccess;
import org.apache.datawise.backend.ddl.CrossDialectDdlTranslator;
import org.apache.datawise.backend.dml.DmlDialectRegistry;
import org.apache.datawise.backend.ops.DatabaseOpsRegistry;
import org.apache.datawise.backend.schema.SchemaDialectRegistry;
import org.apache.datawise.backend.jdbc.execution.JdbcQueryExecutor;
import org.apache.datawise.backend.jdbc.session.JdbcSessionManager;
import org.apache.datawise.backend.jdbc.support.SqlExecutionTracker;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class ConnectorFacadeTest {

    @Mock
    private JdbcQueryExecutor jdbcQueryExecutor;

    @Mock
    private SchemaDialectRegistry schemaDialectRegistry;

    @Mock
    private ConnectorCatalogAccess catalogAccess;

    @Mock
    private CrossDialectDdlTranslator crossDialectDdlTranslator;

    @Mock
    private JdbcSessionManager jdbcSessionManager;

    @Mock
    private SqlExecutionTracker sqlExecutionTracker;

    @Test
    void exposesAllFacadeAccessors() {
        ConnectorPluginContributionHolder contributionHolder = new ConnectorPluginContributionHolder();
        ConnectorJdbcSessionAccess sessionAccess =
                new ConnectorJdbcSessionAccess(jdbcSessionManager, sqlExecutionTracker);
        ConnectorFacade facade = new ConnectorFacade(
                new ConnectorJdbcAccess(jdbcQueryExecutor, sessionAccess),
                new ConnectorDmlAccess(new DmlDialectRegistry(List.of(), contributionHolder)),
                new ConnectorSchemaAccess(schemaDialectRegistry),
                new ConnectorOpsAccess(new DatabaseOpsRegistry(List.of(), List.of(), List.of(), contributionHolder)),
                catalogAccess,
                new ConnectorNativeAccess(catalogAccess),
                new ConnectorMessageBrokerAccess(catalogAccess),
                new ConnectorDdlAccess(crossDialectDdlTranslator),
                new ConnectorDocumentAccess(catalogAccess)
        );

        assertNotNull(facade.jdbc());
        assertNotNull(facade.jdbc().session());
        assertNotNull(facade.dml());
        assertNotNull(facade.schema());
        assertNotNull(facade.ops());
        assertNotNull(facade.catalog());
        assertNotNull(facade.nativeAccess());
        assertNotNull(facade.messageBroker());
        assertNotNull(facade.ddl());
        assertNotNull(facade.document());
    }
}
