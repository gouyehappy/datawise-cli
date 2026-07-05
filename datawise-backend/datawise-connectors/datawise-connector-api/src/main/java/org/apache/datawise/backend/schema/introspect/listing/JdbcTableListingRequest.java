package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.schema.SchemaScope;

import java.sql.Connection;

/** Inputs for a single fast table-listing page query. */
record JdbcTableListingRequest(
        Connection connection,
        String connectionId,
        String catalog,
        String schema,
        SchemaScope scope,
        int offset,
        int limit,
        boolean skeleton,
        String namePattern
) {
}
