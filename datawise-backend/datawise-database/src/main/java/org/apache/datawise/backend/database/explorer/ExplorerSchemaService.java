package org.apache.datawise.backend.database.explorer;

import org.apache.datawise.backend.database.context.ConnectionExecutionContext;
import org.apache.datawise.backend.database.connection.JdbcConnectionPoolWarmupService;

import org.apache.datawise.backend.common.ExplorerConnectionException;

import org.apache.datawise.backend.config.ExplorerSchemaProperties;

import org.apache.datawise.backend.connector.facade.ConnectorFacade;

import org.apache.datawise.backend.configstore.ConnectionStore;

import org.apache.datawise.backend.domain.ConnectionConfig;

import org.apache.datawise.backend.domain.PaginatedTreeNodes;

import org.apache.datawise.backend.domain.TreeNode;

import org.apache.datawise.backend.domain.TreePayload;

import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.model.ConnectionGroupEntity;

import org.apache.datawise.backend.schema.SchemaDialectRegistry;

import org.apache.datawise.backend.schema.introspect.ExplorerSchemaFilter;

import org.apache.datawise.backend.connector.api.support.ConnectionMapper;

import org.apache.datawise.backend.common.support.ExceptionLogging;

import org.apache.datawise.backend.common.support.PerfLogger;

import org.apache.datawise.backend.jdbc.error.JdbcConnectionErrors;

import org.slf4j.Logger;

import org.slf4j.LoggerFactory;

import org.apache.datawise.backend.service.ConnectionVisibilityService;

import org.springframework.stereotype.Service;

import java.io.IOException;

import java.util.ArrayList;
import java.util.HashSet;

import java.util.List;

import java.util.Optional;
import java.util.Set;

/**

 * Explorer schema 门面：连接快照、懒加载树与 workspace 缓存同步。

 */

@Service

public class ExplorerSchemaService {

    private static final Logger log = LoggerFactory.getLogger(ExplorerSchemaService.class);

    private static final String EXPLORER_SCHEMA_LOAD_FAILED = "EXPLORER_SCHEMA_LOAD_FAILED";

    private final ConnectionExecutionContext connectionContext;

    private final ConnectionStore connectionStore;

    private final ExplorerTreeBuilder treeBuilder;

    private final ConnectorFacade connectorFacade;

    private final ExplorerNodeResolver nodeResolver;

    private final ExplorerWorkspaceSync workspaceSync;

    private final ExplorerViewModelSync viewModelSync;

    private final ExplorerSchemaSessionPool schemaSessionPool;

    private final SchemaDialectRegistry dialectRegistry;

    private final ConnectionVisibilityService connectionVisibilityService;

    private final ExplorerSchemaCacheHydrator cacheHydrator;

    private final JdbcConnectionPoolWarmupService poolWarmupService;

    private final ExplorerSchemaProperties schemaProperties;

    public ExplorerSchemaService(

            ConnectionExecutionContext connectionContext,

            ConnectionStore connectionStore,

            ExplorerTreeBuilder treeBuilder,

            ConnectorFacade connectorFacade,

            ExplorerNodeResolver nodeResolver,

            ExplorerWorkspaceSync workspaceSync,

            ExplorerViewModelSync viewModelSync,

            ExplorerSchemaSessionPool schemaSessionPool,

            SchemaDialectRegistry dialectRegistry,

            ExplorerSchemaCacheHydrator cacheHydrator,

            JdbcConnectionPoolWarmupService poolWarmupService,

            ConnectionVisibilityService connectionVisibilityService,

            ExplorerSchemaProperties schemaProperties

    ) {

        this.connectionContext = connectionContext;

        this.connectionStore = connectionStore;

        this.treeBuilder = treeBuilder;

        this.connectorFacade = connectorFacade;

        this.nodeResolver = nodeResolver;

        this.workspaceSync = workspaceSync;

        this.viewModelSync = viewModelSync;

        this.schemaSessionPool = schemaSessionPool;

        this.dialectRegistry = dialectRegistry;

        this.cacheHydrator = cacheHydrator;

        this.poolWarmupService = poolWarmupService;

        this.connectionVisibilityService = connectionVisibilityService;

        this.schemaProperties = schemaProperties;

    }

    public ConnectionConfig getConnection(String connectionId) {

        ConnectionEntity entity = connectionContext.requireConnectionForCurrentUser(

                connectionId,

                ConnectionExecutionContext.EXPLORER_CONNECTION_NOT_FOUND

        ).entity();

        return ConnectionMapper.toDto(entity);

    }

    public List<TreeNode> fetchTree(boolean refresh) {

        connectionContext.requireUserId();

        if (refresh) {

            refreshLiveSchemas();

        }

        ConnectionVisibilityService.VisibleCatalog catalog = connectionVisibilityService.visibleCatalogForCurrentUser();

        prewarmExpandedGroupConnections(catalog);

        return treeBuilder.buildGroups(catalog.groups());

    }

    private void prewarmExpandedGroupConnections(ConnectionVisibilityService.VisibleCatalog catalog) {

        if (catalog == null || catalog.connections() == null || catalog.connections().isEmpty()) {

            return;

        }

        Set<String> expandedGroupIds = new HashSet<>();

        for (ConnectionGroupEntity group : catalog.groups()) {

            if (group != null && group.isExpanded()) {

                expandedGroupIds.add(group.getId());

            }

        }

        if (expandedGroupIds.isEmpty()) {

            return;

        }

        for (ConnectionEntity connection : catalog.connections()) {

            if (connection != null
                    && expandedGroupIds.contains(connection.getGroupId())
                    && JdbcConnectionPoolWarmupService.usesJdbcPool(connection)) {

                poolWarmupService.warmupInBackground(connection);

            }

        }

    }

    public List<TreeNode> loadChildren(String connectionId, String nodeId, String pattern, boolean refresh) {
        return loadChildren(connectionId, nodeId, ExplorerLoadOptions.of(pattern, refresh)).tree();

    }

    public ExplorerTreeLoadResult loadChildren(String connectionId, String nodeId, ExplorerLoadOptions options) {

        ExplorerLoadOptions loadOptions = options != null ? options : ExplorerLoadOptions.of(null, false);

        long startedAt = System.currentTimeMillis();

        long userId = connectionContext.requireUserId();

        ConnectionEntity connection = connectionContext.requireAvailableConnection(

                userId,

                connectionId,

                ConnectionExecutionContext.EXPLORER_CONNECTION_NOT_FOUND

        ).entity();

        try {

            if (connectionId.equals(nodeId)) {

                List<TreeNode> children = loadConnectionRootChildren(

                        connection,

                        loadOptions.pattern(),

                        loadOptions.refresh()

                );

                treeBuilder.saveSchemaChildren(connectionId, children);

                ExplorerTreeLoadResult result = buildLoadResult(connectionId, nodeId, children, null);

                logLoadChildrenPerf(startedAt, connectionId, nodeId, null, result.tree());

                return result;

            }

            if (!connectorFacade.catalog().supportsSchemaTree(connection)) {

                throw ExplorerNodeResolver.nodeNotFound();

            }

            List<TreeNode> schemaRoots = ExplorerSchemaFilter.filterConnectionRoots(

                    treeBuilder.loadSchemaChildren(connectionId),

                    connection.getDbType(),

                    dialectRegistry

            );

            TreeNode target = treeBuilder.findNodeById(schemaRoots, nodeId);

            if (target == null) {

                cacheHydrator.ensureAncestorsLoaded(

                        connectionId,

                        nodeId,

                        schemaRoots,

                        node -> loadChildrenForNode(connection, schemaRoots, node, ExplorerLoadOptions.of(null, false), null).tree()

                );

                target = treeBuilder.findNodeById(schemaRoots, nodeId);

            }

            if (target == null) {

                target = treeBuilder.registerTableNodeIfAbsent(connectionId, nodeId, schemaRoots);

                if (target != null) {

                    treeBuilder.saveSchemaChildren(connectionId, schemaRoots);

                }

            }

            if (target == null) {

                throw ExplorerNodeResolver.nodeNotFound();

            }

            ExplorerTreeLoadResult result = loadChildrenForNode(connection, schemaRoots, target, loadOptions, null);

            logLoadChildrenPerf(startedAt, connectionId, nodeId, target, result.tree());

            return result;

        } catch (ExplorerConnectionException ex) {

            throw ex;

        } catch (IllegalArgumentException ex) {

            throw ex;

        } catch (Exception ex) {

            ExceptionLogging.warn(

                    log,

                    "Failed to load schema children connectionId=" + connectionId + " nodeId=" + nodeId,

                    ex

            );

            throw new ExplorerConnectionException(

                    JdbcConnectionErrors.toUserMessage(connection, ex),

                    EXPLORER_SCHEMA_LOAD_FAILED,

                    ex

            );

        }

    }

    /**
     * Single entry for HTTP loadChildren: cache short-circuit, conditional 304, or live JDBC load.
     */
    public ExplorerChildLoadOutcome loadChildrenWithCaching(
            String connectionId,
            String nodeId,
            ExplorerLoadOptions options,
            String ifNoneMatch
    ) {
        ExplorerLoadOptions loadOptions = options != null ? options : ExplorerLoadOptions.of(null, false);
        long startedAt = System.currentTimeMillis();
        if (canUseConditionalRequest(loadOptions, ifNoneMatch)) {
            Optional<ExplorerTreeLoadResult> cached = resolveCachedLoadChildren(connectionId, nodeId, loadOptions);
            if (cached.isPresent() && ExplorerTreeEtag.matches(ifNoneMatch, cached.get().etag())) {
                logNotModifiedPerf(startedAt, connectionId, nodeId, cached.get().etag(), true);
                return new ExplorerChildLoadOutcome(cached.get(), true, true);
            }
        }
        ExplorerTreeLoadResult result = loadChildren(connectionId, nodeId, loadOptions);
        if (canUseConditionalRequest(loadOptions, ifNoneMatch) && ExplorerTreeEtag.matches(ifNoneMatch, result.etag())) {
            logNotModifiedPerf(startedAt, connectionId, nodeId, result.etag(), false);
            return new ExplorerChildLoadOutcome(result, true, false);
        }
        return new ExplorerChildLoadOutcome(result, false, false);
    }

    /**
     * Resolves loadChildren payload from persisted schema cache only (no JDBC session).
     * Used to short-circuit HTTP 304 when {@code If-None-Match} still matches cached etag.
     */

    public Optional<ExplorerTreeLoadResult> resolveCachedLoadChildren(

            String connectionId,

            String nodeId,

            ExplorerLoadOptions options

    ) {

        ExplorerLoadOptions loadOptions = options != null ? options : ExplorerLoadOptions.of(null, false);

        if (loadOptions.refresh() || (loadOptions.pattern() != null && !loadOptions.pattern().isBlank())) {

            return Optional.empty();

        }

        long userId = connectionContext.requireUserId();

        ConnectionEntity connection = connectionContext.requireAvailableConnection(

                userId,

                connectionId,

                ConnectionExecutionContext.EXPLORER_CONNECTION_NOT_FOUND

        ).entity();

        if (connectionId.equals(nodeId)) {

            return resolveConnectionRootFromCache(connection, connectionId, loadOptions);

        }

        if (!connectorFacade.catalog().supportsSchemaTree(connection)) {

            return Optional.empty();

        }

        List<TreeNode> schemaRoots = ExplorerSchemaFilter.filterConnectionRoots(

                treeBuilder.loadSchemaChildren(connectionId),

                connection.getDbType(),

                dialectRegistry

        );

        TreeNode target = treeBuilder.findNodeById(schemaRoots, nodeId);

        if (target == null) {

            return Optional.empty();

        }

        List<TreeNode> responseChildren = resolveCachedChildren(target, loadOptions);

        if (responseChildren == null) {

            return Optional.empty();

        }

        return Optional.of(buildLoadResult(connectionId, nodeId, responseChildren, target));

    }

    public void syncWorkspacesInCache(String connectionId, String instanceName) throws IOException {

        workspaceSync.syncWorkspacesInCache(connectionId, instanceName);

    }

    public void syncViewModelsInCache(String connectionId, String instanceName) throws IOException {

        viewModelSync.syncViewModelsInCache(connectionId, instanceName);

    }

    private void refreshLiveSchemas() {

        for (ConnectionEntity connection : connectionStore.findAllConnections()) {

            schemaSessionPool.invalidate(connection.getId());

            treeBuilder.saveSchemaChildren(connection.getId(), List.of());

        }

    }

    private List<TreeNode> loadConnectionRootChildren(

            ConnectionEntity connection,

            String pattern,

            boolean refresh

    ) throws Exception {

        String connectionId = connection.getId();

        if (!shouldReloadConnectionRoot(refresh, pattern)) {

            List<TreeNode> cached = treeBuilder.loadSchemaChildren(

                    connectionId,

                    schemaProperties.getSchemaCacheTtlMs()

            );

            if (!cached.isEmpty()) {

                return ExplorerSchemaFilter.filterConnectionRoots(

                        cached,

                        connection.getDbType(),

                        dialectRegistry

                );

            }

        }

        if (refresh) {

            schemaSessionPool.invalidate(connectionId);

        }

        List<TreeNode> children;

        if (connectorFacade.catalog().supportsSchemaTree(connection)) {

            children = schemaSessionPool.withSession(connection, session -> session.introspectConnection());

        } else {

            children = connectorFacade.catalog().loadConnectionRoot(connection, pattern);

        }

        return ExplorerSchemaFilter.filterConnectionRoots(

                children,

                connection.getDbType(),

                dialectRegistry

        );

    }

    private static boolean shouldReloadConnectionRoot(boolean refresh, String pattern) {

        return refresh || (pattern != null && !pattern.isBlank());

    }

    private ExplorerTreeLoadResult loadChildrenForNode(

            ConnectionEntity connection,

            List<TreeNode> schemaRoots,

            TreeNode target,

            ExplorerLoadOptions options,

            String ifNoneMatch

    ) throws Exception {

        if (canUseConditionalRequest(options, ifNoneMatch)) {

            List<TreeNode> cachedChildren = resolveCachedChildren(target, options);

            if (cachedChildren != null) {

                ExplorerTreeLoadResult cached = buildLoadResult(connection.getId(), target.getId(), cachedChildren, target);

                if (ExplorerTreeEtag.matches(ifNoneMatch, cached.etag())) {

                    return cached;

                }

            }

        }

        if (options.refresh()) {

            schemaSessionPool.invalidate(connection.getId());

        }

        List<TreeNode> children = schemaSessionPool.withSession(

                connection,

                session -> nodeResolver.resolveChildren(session, schemaRoots, target, options)

        );

        boolean pagedTablesAppend = ExplorerNodeResolver.isTablesFolder(target) && options.resolvedOffset() > 0;

        List<TreeNode> stripped = stripLoadMoreNodes(children);

        if (pagedTablesAppend) {

            treeBuilder.appendUniqueChildren(schemaRoots, target.getId(), stripped);

        } else {

            treeBuilder.replaceNodeChildren(schemaRoots, target.getId(), stripped);

        }

        if (ExplorerNodeResolver.isLazyLoadFolder(target) && (!ExplorerNodeResolver.isTablesFolder(target) || !pagedTablesAppend)) {

            ExplorerTreeMarkers.markFolderLoaded(
                    treeBuilder.findNodeById(schemaRoots, target.getId()),
                    target.getLabel()
            );

        }

        treeBuilder.saveSchemaChildren(connection.getId(), schemaRoots);

        return buildLoadResult(connection.getId(), target.getId(), children, target);

    }

    private Optional<ExplorerTreeLoadResult> resolveConnectionRootFromCache(

            ConnectionEntity connection,

            String connectionId,

            ExplorerLoadOptions loadOptions

    ) {

        if (shouldReloadConnectionRoot(loadOptions.refresh(), loadOptions.pattern())) {

            return Optional.empty();

        }

        List<TreeNode> cached = treeBuilder.loadSchemaChildren(

                connectionId,

                schemaProperties.getSchemaCacheTtlMs()

        );

        if (cached.isEmpty()) {

            return Optional.empty();

        }

        List<TreeNode> children = ExplorerSchemaFilter.filterConnectionRoots(

                cached,

                connection.getDbType(),

                dialectRegistry

        );

        return Optional.of(buildLoadResult(connectionId, connectionId, children, null));

    }

    private List<TreeNode> resolveCachedChildren(TreeNode target, ExplorerLoadOptions options) {

        if (ExplorerNodeResolver.isTablesFolder(target)) {

            return resolveCachedTablesChildren(target, options);

        }

        if (ExplorerNodeResolver.isLazyLoadFolder(target)) {

            if (ExplorerTreeMarkers.isFolderLoaded(target)) {

                return target.getChildren() != null ? target.getChildren() : List.of();

            }

            List<TreeNode> children = target.getChildren();

            if (children == null || children.isEmpty()) {

                return null;

            }

            return children;

        }

        return target.getChildren();

    }

    private List<TreeNode> resolveCachedTablesChildren(TreeNode target, ExplorerLoadOptions options) {

        List<TreeNode> cachedTables = stripLoadMoreNodes(target.getChildren());

        if (cachedTables.isEmpty()) {

            if (!ExplorerTreeMarkers.isTablesFolderLoaded(target) || options.resolvedOffset() > 0) {

                return null;

            }

            return List.of();

        }

        int offset = options.resolvedOffset();

        if (offset >= cachedTables.size()) {

            return null;

        }

        int pageSize = options.limit() != null && options.limit() > 0

                ? options.limit()

                : schemaProperties.getTableListPageSize();

        PaginatedTreeNodes page = PaginatedTreeNodes.slice(cachedTables, offset, pageSize);

        return page.appendLoadMoreNode(target.getId() + ":load-more", "Load more");

    }

    private ExplorerTreeLoadResult buildLoadResult(

            String connectionId,

            String nodeId,

            List<TreeNode> children,

            TreeNode target

    ) {

        List<TreeNode> responseNodes = children != null ? children : List.of();

        Boolean hasMore = null;

        Integer nextOffset = null;

        if (target != null && ExplorerNodeResolver.isTablesFolder(target)) {

            PaginatedTreeNodes.Pagination pagination = PaginatedTreeNodes.paginationOf(responseNodes);

            hasMore = pagination.hasMore();

            nextOffset = pagination.nextOffset();

        }

        List<TreeNode> payloadNodes = shouldSlimTableList(target)

                ? ExplorerTreeSupport.toSkeletonResponse(responseNodes)

                : responseNodes;

        long cacheVersion = treeBuilder.schemaCacheVersion(connectionId);

        String etag = ExplorerTreeEtag.of(connectionId, nodeId, payloadNodes, cacheVersion);

        TreePayload payload = new TreePayload(payloadNodes, hasMore, nextOffset, etag);

        return new ExplorerTreeLoadResult(payload, etag);

    }

    private static boolean shouldSlimTableList(TreeNode target) {

        return target != null && ExplorerNodeResolver.isTablesFolder(target);

    }

    private static List<TreeNode> stripLoadMoreNodes(List<TreeNode> nodes) {

        if (nodes == null || nodes.isEmpty()) {

            return List.of();

        }

        List<TreeNode> withoutLoadMore = new ArrayList<>(nodes.size());

        for (TreeNode node : nodes) {

            if (node != null && !"load_more".equals(node.getType())) {

                withoutLoadMore.add(node);

            }

        }

        return withoutLoadMore;

    }

    private void logLoadChildrenPerf(

            long startedAt,

            String connectionId,

            String nodeId,

            TreeNode target,

            List<TreeNode> children

    ) {

        PerfLogger.log(

                log,

                resolveLoadChildrenOperation(connectionId, nodeId, target),

                startedAt,

                "connectionId", connectionId,

                "nodeId", nodeId,

                "nodeType", target != null ? target.getType() : "connection",

                "nodeLabel", target != null ? target.getLabel() : "",

                "childCount", children != null ? children.size() : 0

        );

    }

    private static String resolveLoadChildrenOperation(String connectionId, String nodeId, TreeNode target) {

        if (connectionId.equals(nodeId)) {

            return "connection.expand";

        }

        if (target != null && "folder".equals(target.getType())) {

            return switch (target.getLabel() != null ? target.getLabel().toLowerCase() : "") {

                case "tables" -> "explorer.loadTables";

                case "workspaces" -> "explorer.loadWorkspaces";

                case "models" -> "explorer.loadModels";

                case "views" -> "explorer.loadViews";

                default -> "explorer.loadChildren";

            };

        }

        return "explorer.loadChildren";

    }

    private static boolean canUseConditionalRequest(ExplorerLoadOptions options, String ifNoneMatch) {
        if (ifNoneMatch == null || ifNoneMatch.isBlank()) {
            return false;
        }
        if (options.refresh()) {
            return false;
        }
        String pattern = options.pattern();
        return pattern == null || pattern.isBlank();
    }

    private void logNotModifiedPerf(
            long startedAt,
            String connectionId,
            String nodeId,
            String etag,
            boolean shortCircuited
    ) {
        PerfLogger.log(
                log,
                "explorer.loadChildren.notModified",
                startedAt,
                "connectionId", connectionId,
                "nodeId", nodeId,
                "etag", ExplorerTreeEtag.stripQuotes(etag),
                "fromCache", true,
                "shortCircuit", shortCircuited
        );
    }

}
