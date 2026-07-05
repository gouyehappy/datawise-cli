package org.apache.datawise.backend.database.explorer;

import org.apache.datawise.backend.common.ExplorerConnectionException;
import org.apache.datawise.backend.connector.catalog.SchemaSession;
import org.apache.datawise.backend.config.ExplorerSchemaProperties;
import org.apache.datawise.backend.domain.PaginatedTreeNodes;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.schema.CatalogSchemaScope;
import org.apache.datawise.backend.service.InstanceWorkspaceService;
import org.apache.datawise.backend.service.ViewModelService;
import org.springframework.stereotype.Service;

import java.util.List;

/** Explorer schema 树节点子级解析（database / schema / table / folder 等）。 */
@Service
public class ExplorerNodeResolver {

    private final ExplorerTreeBuilder treeBuilder;
    private final InstanceWorkspaceService instanceWorkspaceService;
    private final ViewModelService viewModelService;
    private final ExplorerSchemaProperties schemaProperties;

    public ExplorerNodeResolver(
            ExplorerTreeBuilder treeBuilder,
            InstanceWorkspaceService instanceWorkspaceService,
            ViewModelService viewModelService,
            ExplorerSchemaProperties schemaProperties
    ) {
        this.treeBuilder = treeBuilder;
        this.instanceWorkspaceService = instanceWorkspaceService;
        this.viewModelService = viewModelService;
        this.schemaProperties = schemaProperties;
    }

    public static ExplorerConnectionException nodeNotFound() {
        return new ExplorerConnectionException("EXPLORER_NODE_NOT_FOUND", "EXPLORER_NODE_NOT_FOUND");
    }

    public List<TreeNode> resolveChildren(
            SchemaSession session,
            List<TreeNode> schemaRoots,
            TreeNode target
    ) throws Exception {
        return resolveChildren(session, schemaRoots, target, ExplorerLoadOptions.of(null, false));
    }

    public List<TreeNode> resolveChildren(
            SchemaSession session,
            List<TreeNode> schemaRoots,
            TreeNode target,
            ExplorerLoadOptions options
    ) throws Exception {
        ExplorerLoadOptions loadOptions = options != null ? options : ExplorerLoadOptions.of(null, false);
        return switch (target.getType()) {
            case "database" -> session.loadDatabaseChildren(target.getLabel());
            case "schema" -> {
                String catalog = treeBuilder.findDatabaseCatalog(schemaRoots, target.getId());
                if (catalog == null) {
                    throw new IllegalArgumentException("Catalog not found for schema node");
                }
                yield session.loadSchemaChildren(catalog, target.getLabel());
            }
            case "table" -> {
                ExplorerTreeBuilder.CatalogSchemaContext context =
                        treeBuilder.findCatalogSchemaContext(schemaRoots, target.getId());
                if (context == null) {
                    throw new IllegalArgumentException("Catalog not found for table node");
                }
                if (context.schema() != null) {
                    yield session.loadTableSkeletonChildren(context.catalog(), context.schema(), target.getLabel());
                }
                yield session.loadTableSkeletonChildren(context.catalog(), target.getLabel());
            }
            case "view" -> {
                ExplorerTreeBuilder.CatalogSchemaContext context =
                        treeBuilder.findCatalogSchemaContext(schemaRoots, target.getId());
                if (context == null) {
                    throw new IllegalArgumentException("Catalog not found for view node");
                }
                if (context.schema() != null) {
                    yield session.loadViewSkeletonChildren(context.catalog(), context.schema(), target.getLabel());
                }
                yield session.loadViewSkeletonChildren(context.catalog(), target.getLabel());
            }
            case "columns", "keys", "indexes" -> loadRelationSectionChildren(session, schemaRoots, target);
            case "folder" -> resolveFolderChildren(session, schemaRoots, target, loadOptions);
            default -> target.getChildren() != null ? target.getChildren() : List.of();
        };
    }

    private List<TreeNode> resolveFolderChildren(
            SchemaSession session,
            List<TreeNode> schemaRoots,
            TreeNode target,
            ExplorerLoadOptions options
    ) throws Exception {
        if ("tables".equalsIgnoreCase(target.getLabel())) {
            ExplorerTreeBuilder.CatalogSchemaContext context = resolveTablesFolderContext(schemaRoots, target);
            int pageSize = options.limit() != null && options.limit() > 0
                    ? options.limit()
                    : schemaProperties.getTableListPageSize();
            int offset = options.resolvedOffset();
            PaginatedTreeNodes page;
            if (context.schema() != null) {
                page = session.loadTableListPage(
                        context.catalog(),
                        context.schema(),
                        offset,
                        pageSize,
                        options.skeleton(),
                        options.pattern()
                );
            } else {
                page = session.loadTableListPage(
                        context.catalog(),
                        null,
                        offset,
                        pageSize,
                        options.skeleton(),
                        options.pattern()
                );
            }
            return page.appendLoadMoreNode(loadMoreNodeId(target), "Load more");
        }
        if ("workspaces".equalsIgnoreCase(target.getLabel())) {
            ExplorerTreeBuilder.CatalogSchemaContext context = resolveTablesFolderContext(schemaRoots, target);
            String instanceKey = CatalogSchemaScope.formatInstanceKey(context.catalog(), context.schema());
            return instanceWorkspaceService.listSqlFileNodes(session.connectionId(), instanceKey);
        }
        if ("views".equalsIgnoreCase(target.getLabel())) {
            ExplorerTreeBuilder.CatalogSchemaContext context = resolveTablesFolderContext(schemaRoots, target);
            if (context.schema() != null) {
                return session.loadViewList(context.catalog(), context.schema());
            }
            return session.loadViewList(context.catalog());
        }
        if ("models".equalsIgnoreCase(target.getLabel())) {
            ExplorerTreeBuilder.CatalogSchemaContext context = resolveTablesFolderContext(schemaRoots, target);
            String instanceKey = CatalogSchemaScope.formatInstanceKey(context.catalog(), context.schema());
            return viewModelService.listViewModelNodes(session.connectionId(), instanceKey);
        }
        return target.getChildren() != null ? target.getChildren() : List.of();
    }

    public static boolean isTablesFolder(TreeNode target) {
        return target != null && "folder".equals(target.getType()) && "tables".equalsIgnoreCase(target.getLabel());
    }

    public static boolean isLazyLoadFolder(TreeNode target) {
        return target != null
                && "folder".equals(target.getType())
                && ExplorerTreeMarkers.supportsLazyLoadFolderLabel(target.getLabel());
    }

    private static String loadMoreNodeId(TreeNode folderNode) {
        return folderNode.getId() + ":load-more";
    }

    private ExplorerTreeBuilder.CatalogSchemaContext resolveTablesFolderContext(
            List<TreeNode> schemaRoots,
            TreeNode folderNode
    ) {
        TreeNode schemaNode = treeBuilder.findParentById(schemaRoots, folderNode.getId());
        if (schemaNode != null && "schema".equals(schemaNode.getType())) {
            TreeNode catalogNode = treeBuilder.findParentById(schemaRoots, schemaNode.getId());
            if (catalogNode == null || !"database".equals(catalogNode.getType())) {
                throw new IllegalArgumentException("Parent catalog not found for schema tables folder");
            }
            return new ExplorerTreeBuilder.CatalogSchemaContext(catalogNode.getLabel(), schemaNode.getLabel());
        }
        TreeNode databaseNode = treeBuilder.findParentById(schemaRoots, folderNode.getId());
        if (databaseNode == null || !"database".equals(databaseNode.getType())) {
            throw new IllegalArgumentException("Parent database not found for tables folder");
        }
        return new ExplorerTreeBuilder.CatalogSchemaContext(databaseNode.getLabel(), null);
    }

    private List<TreeNode> loadRelationSectionChildren(
            SchemaSession session,
            List<TreeNode> schemaRoots,
            TreeNode target
    ) throws Exception {
        TreeNode relationNode = treeBuilder.findParentById(schemaRoots, target.getId());
        if (relationNode == null
                || (!"table".equals(relationNode.getType()) && !"view".equals(relationNode.getType()))) {
            throw new IllegalArgumentException("Parent table or view not found for section node");
        }
        ExplorerTreeBuilder.CatalogSchemaContext context =
                treeBuilder.findCatalogSchemaContext(schemaRoots, relationNode.getId());
        if (context == null) {
            throw new IllegalArgumentException("Catalog not found for table section node");
        }
        String relationName = relationNode.getLabel();
        boolean view = "view".equals(relationNode.getType());
        if (view && ("keys".equals(target.getType()) || "indexes".equals(target.getType()))) {
            return List.of();
        }
        if (context.schema() != null) {
            return switch (target.getType()) {
                case "columns" -> session.loadColumnChildren(context.catalog(), context.schema(), relationName);
                case "keys" -> view ? List.of() : session.loadKeyChildren(context.catalog(), context.schema(), relationName);
                case "indexes" -> view ? List.of() : session.loadIndexChildren(context.catalog(), context.schema(), relationName);
                default -> List.of();
            };
        }
        return switch (target.getType()) {
            case "columns" -> session.loadColumnChildren(context.catalog(), relationName);
            case "keys" -> view ? List.of() : session.loadKeyChildren(context.catalog(), relationName);
            case "indexes" -> view ? List.of() : session.loadIndexChildren(context.catalog(), relationName);
            default -> List.of();
        };
    }
}
