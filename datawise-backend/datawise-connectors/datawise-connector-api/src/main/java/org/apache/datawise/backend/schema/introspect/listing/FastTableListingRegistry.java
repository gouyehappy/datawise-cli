package org.apache.datawise.backend.schema.introspect.listing;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.schema.introspect.SchemaTreeBuilder;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

final class FastTableListingRegistry {

    private final List<FastTableLister> listers;

    FastTableListingRegistry(SchemaTreeBuilder treeBuilder) {
        JdbcTableListingSupport support = new JdbcTableListingSupport(treeBuilder);
        listers = List.of(
                new MysqlProtocolFastTableLister(support),
                new PostgresqlFastTableLister(support),
                new SqlServerFastTableLister(support),
                new OracleFastTableLister(support),
                new CatalogSchemaFastTableLister(support),
                new Db2FastTableLister(support),
                new ClickHouseFastTableLister(support),
                new SqliteFastTableLister(support),
                new EmbeddedEngineFastTableLister(support)
        );
    }

    boolean supportsFastListing(String dbType) {
        return find(dbType).isPresent();
    }

    Optional<FastTableLister> find(String dbType) {
        return listers.stream().filter(lister -> lister.supports(dbType)).findFirst();
    }

    PaginatedTreeNodes listTablesPage(JdbcTableListingRequest request, String dbType) throws SQLException {
        FastTableLister lister = find(dbType).orElse(null);
        if (lister == null) {
            return null;
        }
        return lister.listTablesPage(request);
    }
}
