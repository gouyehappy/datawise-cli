package org.apache.datawise.backend.database.connection;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.configstore.ConfigDirectoryService;
import org.apache.datawise.backend.configstore.ConnectionStore;
import org.apache.datawise.backend.configstore.SessionEphemeralCatalogStore;
import org.apache.datawise.backend.configstore.TeamStore;
import org.apache.datawise.backend.domain.ConnectionEntryDto;
import org.apache.datawise.backend.domain.ConnectionGroupDto;
import org.apache.datawise.backend.domain.ConnectionsCatalogDto;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.security.SecretValueCodec;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.connector.api.support.ConnectionMapper;
import org.apache.datawise.backend.service.ConnectionVisibilityService;
import org.apache.datawise.backend.service.UserAccessPolicy;
import org.apache.datawise.backend.service.UserResourcePolicy;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConnectionsCatalogServiceTest {

    @TempDir
    Path tempDir;

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void exportAndReplaceCatalogRoundTrip() {
        SecretValueCodec codec = mock(SecretValueCodec.class);
        when(codec.encryptForStorage(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(codec.decryptForUse(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ConfigDirectoryService configDirectory = new ConfigDirectoryService(tempDir);
        ConnectionStore store = new ConnectionStore(configDirectory, new ObjectMapper(), codec);
        ConnectionVisibilityService visibilityService = new ConnectionVisibilityService(
                store,
                new SessionEphemeralCatalogStore(),
                new TeamStore(configDirectory, new ObjectMapper())
        );
        UserResourcePolicy resourcePolicy = new UserResourcePolicy(new UserAccessPolicy());
        ConnectionsCatalogService service = new ConnectionsCatalogService(store, visibilityService, resourcePolicy);
        UserContext.set(1L, false, "session-test");

        ConnectionEntity connection = new ConnectionEntity();
        connection.setId("conn-1");
        connection.setGroupId("group-1");
        connection.setName("Local MySQL");
        connection.setDbType("mysql");
        connection.setSortOrder(0);

        service.replaceCatalog(new ConnectionsCatalogDto(
                1,
                List.of(new ConnectionGroupDto("group-1", "Default", null, 0, true, null)),
                List.of(new ConnectionEntryDto(
                        "conn-1",
                        "group-1",
                        0,
                        null,
                        ConnectionMapper.toDto(connection)
                ))
        ));

        ConnectionsCatalogDto exported = service.exportCatalog();
        assertEquals(1, exported.connections().size());
        assertEquals("Local MySQL", exported.connections().get(0).config().getName());
    }
}
