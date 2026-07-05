package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;

import java.sql.SQLException;

interface FastTableLister {

    boolean supports(String dbType);

    PaginatedTreeNodes listTablesPage(JdbcTableListingRequest request) throws SQLException;
}
