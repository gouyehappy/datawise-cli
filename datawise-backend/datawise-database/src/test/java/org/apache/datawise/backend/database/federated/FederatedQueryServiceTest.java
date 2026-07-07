package org.apache.datawise.backend.database.federated;

import org.apache.datawise.backend.configstore.FederatedViewStore;
import org.apache.datawise.backend.database.sql.SqlService;
import org.apache.datawise.backend.model.FederatedViewEntry;
import org.apache.datawise.backend.model.FederatedViewSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class FederatedQueryServiceTest {

    private SqlService sqlService;
    private FederatedQueryService service;

    @BeforeEach
    void setUp() {
        sqlService = mock(SqlService.class);
        service = new FederatedQueryService(mock(FederatedViewStore.class), sqlService);
    }

    @Test
    void executeViewRejectsUnsupportedJoinBeforeExecutingSources() {
        FederatedViewEntry view = new FederatedViewEntry();
        view.setId("fview-1");
        view.setName("orders with users");
        view.setSources(List.of(source("orders"), source("users")));
        view.setSql("select * from @orders o join @users u on o.user_id = u.id");

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> service.executeView(view, 100)
        );

        assertEquals("federated JOIN execution is not supported yet", ex.getMessage());
        verifyNoInteractions(sqlService);
    }

    private static FederatedViewSource source(String alias) {
        FederatedViewSource source = new FederatedViewSource();
        source.setAlias(alias);
        source.setConnectionId("conn-" + alias);
        source.setDatabase("shop");
        return source;
    }
}