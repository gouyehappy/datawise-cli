package org.apache.datawise.backend.ai.tag;

import org.apache.datawise.backend.configstore.AiTableTagStore;
import org.apache.datawise.backend.domain.UpdateAiTableTagsRequest;
import org.apache.datawise.backend.model.AiTableTagEntry;
import org.apache.datawise.backend.service.ConnectionVisibilityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiTableTagServiceTest {

    private AiTableTagStore store;
    private ConnectionVisibilityService connectionVisibilityService;
    private AiTableTagService service;

    @BeforeEach
    void setUp() {
        store = mock(AiTableTagStore.class);
        connectionVisibilityService = mock(ConnectionVisibilityService.class);
        service = new AiTableTagService(store, connectionVisibilityService);
    }

    @Test
    void filterTaggedTablesReturnsOnlyTaggedCandidates() {
        when(store.listScoped("conn-1", "shop")).thenReturn(List.of(entry("orders"), entry("users")));

        List<String> filtered = service.filterTaggedTables(
                "conn-1",
                "shop",
                List.of("orders", "products", "users")
        );

        assertEquals(List.of("orders", "users"), filtered);
    }

    @Test
    void filterTaggedTablesReturnsEmptyWhenNothingTagged() {
        when(store.listScoped("conn-1", "shop")).thenReturn(List.of());

        assertTrue(service.filterTaggedTables("conn-1", "shop", List.of("orders")).isEmpty());
    }

    @Test
    void updateTagsAddsAndRemovesEntries() {
        when(store.listScoped("conn-1", "shop")).thenReturn(List.of(entry("orders")));

        service.updateTags(new UpdateAiTableTagsRequest(
                "conn-1",
                "shop",
                List.of("orders", "users"),
                true
        ));
        verify(store, times(2)).upsert(any(AiTableTagEntry.class));

        service.updateTags(new UpdateAiTableTagsRequest(
                "conn-1",
                "shop",
                List.of("orders"),
                false
        ));
        verify(store).removeScoped("conn-1", "shop", "orders");
    }

    @Test
    void entryIdIsStableForSameScope() {
        assertEquals(
                AiTableTagService.entryId("conn-1", "shop", "Orders"),
                AiTableTagService.entryId("conn-1", "shop", "orders")
        );
    }

    private static AiTableTagEntry entry(String tableName) {
        AiTableTagEntry entry = new AiTableTagEntry();
        entry.setTableName(tableName);
        return entry;
    }
}
