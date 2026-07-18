package org.apache.datawise.backend.service.discovery;

import org.apache.datawise.backend.configstore.SchemaCacheStore;
import org.apache.datawise.backend.configstore.SemanticMetricStore;
import org.apache.datawise.backend.domain.DiscoveryHitDto;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.model.SemanticMetricEntry;
import org.apache.datawise.backend.service.ConnectionVisibilityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DiscoverySearchServiceTest {

    private ConnectionVisibilityService visibility;
    private SchemaCacheStore schemaCacheStore;
    private SemanticMetricStore metricStore;
    private DiscoverySearchService service;

    @BeforeEach
    void setUp() {
        visibility = mock(ConnectionVisibilityService.class);
        schemaCacheStore = mock(SchemaCacheStore.class);
        metricStore = mock(SemanticMetricStore.class);
        service = new DiscoverySearchService(visibility, schemaCacheStore, metricStore);
    }

    @Test
    void searchMatchesCachedTablesAndMetricsByOwner() {
        ConnectionEntity connection = new ConnectionEntity();
        connection.setId("conn-1");
        connection.setName("Shop DB");
        connection.setDbType("mysql");

        when(visibility.visibleCatalogForCurrentUser())
                .thenReturn(new ConnectionVisibilityService.VisibleCatalog(List.of(), List.of(connection)));

        TreeNode database = node("db-shop", "shop", "database");
        TreeNode table = node("tbl-orders", "orders", "table");
        table.setComment("customer orders");
        database.setChildren(List.of(table));
        when(schemaCacheStore.load("conn-1")).thenReturn(List.of(database));

        SemanticMetricEntry metric = new SemanticMetricEntry();
        metric.setId("metric-gmv");
        metric.setConnectionId("conn-1");
        metric.setDatabase("shop");
        metric.setName("gmv");
        metric.setDescription("gross merchandise value");
        metric.setOwner("alice");
        when(metricStore.listAll()).thenReturn(List.of(metric));

        List<DiscoveryHitDto> byTable = service.search("orders", 20);
        assertEquals(1, byTable.size());
        assertEquals("table", byTable.get(0).kind());
        assertEquals("orders", byTable.get(0).name());

        List<DiscoveryHitDto> byOwner = service.search("alice", 20);
        assertEquals(1, byOwner.size());
        assertEquals("metric", byOwner.get(0).kind());
        assertEquals("alice", byOwner.get(0).owner());
        assertTrue(byOwner.get(0).subtitle() != null && byOwner.get(0).subtitle().contains("alice"));
    }

    @Test
    void emptyQueryReturnsNothing() {
        assertTrue(service.search("  ", 10).isEmpty());
    }

    private static TreeNode node(String id, String label, String type) {
        TreeNode node = new TreeNode();
        node.setId(id);
        node.setLabel(label);
        node.setType(type);
        return node;
    }
}
