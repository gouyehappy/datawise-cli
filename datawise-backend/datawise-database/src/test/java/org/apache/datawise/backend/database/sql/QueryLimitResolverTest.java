package org.apache.datawise.backend.database.sql;

import org.apache.datawise.backend.config.DatawiseQueryProperties;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class QueryLimitResolverTest {

    @Test
    void bothUnlimitedReturnsZero() {
        QueryLimitResolver resolver = resolver(0);
        assertEquals(0, resolver.resolve(null));
        assertEquals(0, resolver.resolve(0));
    }

    @Test
    void clientLimitWhenServerUnlimited() {
        QueryLimitResolver resolver = resolver(0);
        assertEquals(500, resolver.resolve(500));
    }

    @Test
    void serverDefaultWhenClientMissing() {
        QueryLimitResolver resolver = resolver(200);
        assertEquals(200, resolver.resolve(null));
        assertEquals(200, resolver.resolve(0));
    }

    @Test
    void usesMinimumOfClientAndServer() {
        QueryLimitResolver resolver = resolver(500);
        assertEquals(200, resolver.resolve(200));
        assertEquals(500, resolver.resolve(1000));
    }

    private static QueryLimitResolver resolver(int serverMax) {
        DatawiseQueryProperties properties = new DatawiseQueryProperties();
        properties.setMaxResultRows(serverMax);
        return new QueryLimitResolver(properties);
    }
}
