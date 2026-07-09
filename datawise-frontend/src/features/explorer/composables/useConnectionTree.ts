import {computed, onMounted, onUnmounted, ref, toRef} from 'vue'
import {useI18n} from 'vue-i18n'
import type {ContextMenuItem, TreeNode} from '@/core/types'
import {useContextMenuAnchor} from '@/core/context-menu'
import {findAncestorByType, findDatabaseLabel} from '@/core/utils/tree'
import {parseDbTypeMenuId} from '@/features/explorer/constants/explorer-add-menu'
import {getContextMenuForNodeType} from '@/features/explorer/constants/context-menus'
import {useDataSourceFlatNodes} from '@/features/explorer/composables/useDataSourceFlatNodes'
import {
    buildExplorerNodeInfo,
    isExplorerInfoNode,
    prepareExplorerInfoNode,
} from '@/features/explorer/services/explorer-node-info.service'
import {
    buildDatabaseConsoleContext,
    createNewSqlEditor,
    openBlankSqlConsole,
    openLatestSqlEditor,
} from '@/features/explorer/services/sql-editor-actions.service'
import type {DatabaseConsoleContext} from '@/features/explorer/services/sql-editor-actions.service'
import {openSqlFileFromTree} from '@/features/explorer/services/instance-console.service'
import {deleteInstanceSqlScript} from '@/features/explorer/services/sql-script.service'
import {useScriptHistoryDrawerStore} from '@/features/explorer/stores/script-history-drawer-store'
import {runSqlFileForDatabase} from '@/features/explorer/services/run-sql-file.service'
import {
    resolvePlatformFeatureId,
} from '@/features/explorer/services/explorer-ai-tree.service'
import type {PlatformFeatureId} from '@/features/platform/types/platform.types'
import {resolveSchemaScopeFromDatabaseNode} from '@/features/schema-compare/services/schema-scope.service'
import {resolveExplorerSchemaErContext} from '@/features/explorer/services/schema-er-context.service'
import {
    copySqlToClipboard,
    downloadSqlFile,
    includeDataForExportAction,
    resolveExplorerSqlExportContext,
    shouldDownloadExportAction,
    type ExplorerSqlExportAction,
} from '@/features/explorer/services/table-sql-export.service'
import {
    buildDropTableSql,
    buildInsertStatementsFromCsv,
    buildTruncateTableSql,
    exportTableDataCsv,
    parseSpreadsheetFile,
    pickSpreadsheetFile,
    resolveTableContext,
} from '@/features/explorer/services/table-context-actions.service'
import {
    applySqlExportWizardOutput,
    countTablesUnderDatabase,
    runSqlExportWizard,
    type SqlExportWizardContext,
    type SqlExportWizardForm,
} from '@/features/explorer/services/sql-export-wizard.service'
import {
    resolveTableMigrationContext,
} from '@/features/explorer/services/table-migration.service'
import {parseRedisKeyFromNodeId} from '@/features/explorer/services/redis-key.service'
import {parseKafkaTopicFromNodeId} from '@/features/explorer/services/kafka-topic.service'
import {parseRedisFeatureId} from '@/features/explorer/services/redis-feature-tree.service'
import {parseKafkaFeatureId} from '@/features/explorer/services/kafka-feature-tree.service'
import {isPinnableExplorerNode} from '@/features/explorer/services/explorer-pinned-sort.service'
import {
    isExplorerFavoritesTreeNode,
    isExplorerFavoritesViewAllNode,
    openPinnedTableFavorite,
    shouldOpenFavoriteTable,
} from '@/features/explorer/services/explorer-favorites.actions'
import {isExplorerFavoritesGroupId} from '@/features/explorer/services/explorer-favorites.constants'
import {
    resolveExplorerInstanceLabel,
    resolveExplorerSqlFileScope,
} from '@/features/explorer/services/explorer-database-scope'
import {
    canMoveConnectionToGroup,
    injectConnectionMoveSubmenu,
    listConnectionMoveTargets,
    parseMoveTargetMenuId,
} from '@/features/explorer/services/explorer-move-connection.service'
import {
    buildConnectionLifecycleMenuItems,
    prependConnectionLifecycleMenu,
    resolveConnectionLinkState,
} from '@/features/explorer/services/explorer-connection-lifecycle.service'
import {shouldCollapseOnDoubleClick} from '@/features/explorer/services/explorer-tree-expansion'
import {resolveConnectionDbType} from '@/features/explorer/services/explorer-lazy-load'
import {
    registerExplorerDatabaseShortcutHandler,
} from '@/features/explorer/services/explorer-database-shortcuts.service'
import type {ExplorerDatabaseShortcutAction} from '@/features/explorer/services/explorer-database-shortcuts.service'
import {
    clearExplorerNodeShortcutHandlers,
    registerExplorerNodeShortcutHandlers,
} from '@/features/explorer/services/explorer-node-shortcuts.service'
import {
    filterConnectionCapabilityMenuItems,
    filterSqlContextMenuItems,
    isCsvImportSupported,
} from '@/shared/capabilities/db-type-capabilities'
import {executeSqlBatch} from '@/features/workspace/services/sql-batch-execute.service'
import {resolveClientMaxResultRows} from '@/features/settings/services/query-limit.service'
import {sqlFileNameFromTabLabel} from '@/features/workspace/services/console-tab-title'
import {useDatasourceCatalogStore} from '@/features/datasource/stores/datasource-catalog'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useShortcutPanelStore} from '@/features/layout/stores/shortcut-panel-store'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {filterPluginGatedMenuItems} from '@/features/plugin/services/plugin-registry.service'
import {instanceSqlApi, sqlApi, tableDataApi, tableDetailApi} from '@/api'
import {
    resolveViewModelScope,
    resolveViewsFolderScope,
    viewModelApi,
} from '@/api/modules/view-model'
import {isValidViewModelBaseName, stripViewModelDisplayName} from '@/features/explorer/services/view-model-naming'
import {isViewModelDraftNode} from '@/features/explorer/services/view-model-tree.service'

function stripSqlExtension(fileName: string): string {
    return fileName.replace(/\.sql$/i, '')
}

/** 连接树交互：选中、打开、右键菜单 */
export function useConnectionTree() {
    const {t} = useI18n()
    const explorer = useExplorerStore()
    const workspace = useWorkspaceStore()
    const layout = useLayoutStore()
    const shortcutPanel = useShortcutPanelStore()
    const catalogStore = useDatasourceCatalogStore()

    const {visible: menuVisible, pos: menuPos, target: contextNode, open, close: closeMenu} =
        useContextMenuAnchor<TreeNode>()
    const menuItems = ref<ContextMenuItem[]>([])

    const showRenameDialog = ref(false)
    const showRenameSqlDialog = ref(false)
    const showDeleteSqlDialog = ref(false)
    const showSubgroupDialog = ref(false)
    const renameDefaultName = ref('')
    const renameSqlDefaultName = ref('')
    const deleteSqlMessage = ref('')
    const subgroupDefaultName = computed(() => t('explorer.folderNameDefault'))
    const pendingGroupNode = ref<TreeNode | null>(null)
    const pendingSqlFileNode = ref<TreeNode | null>(null)
    const pendingViewModelNode = ref<TreeNode | null>(null)
    const showRenameViewModelDialog = ref(false)
    const renameViewModelDefaultName = ref('')
    const showDeleteViewModelDialog = ref(false)
    const deleteViewModelMessage = ref('')
    const showMigrateViewModelDialog = ref(false)
    const migrateViewModelTargetTable = ref('')
    const pendingMigrateViewModelSql = ref('')
    const showRecentSqlDialog = ref(false)
    const recentSqlContext = ref<DatabaseConsoleContext | null>(null)
    const showTableActionDialog = ref(false)
    const pendingTableAction = ref<{
        type: 'truncate' | 'delete'
        node: TreeNode
        message: string
    } | null>(null)
    const showSqlExportWizard = ref(false)
    const sqlExportWizardContext = ref<SqlExportWizardContext | null>(null)
    const sqlExportWizardExporting = ref(false)
    const sqlExportWizardMaxRowsDefault = computed(() => resolveClientMaxResultRows())

    const flatNodes = useDataSourceFlatNodes(toRef(explorer, 'debouncedSearchQuery')).flatNodes

    async function syncViewModelExplorerInfo(node: TreeNode) {
        const connectionId = findConnectionId(node)
        const scope = resolveViewModelScope(explorer.tree, node.id)
        if (!connectionId || !scope) return
        const connection = findAncestorByType(explorer.tree, node.id, 'connection')
        try {
            const result = await viewModelApi.read({
                connectionId,
                instanceName: scope.instanceLabel,
                name: node.label,
            })
            shortcutPanel.syncExplorerInfo({
                kind: 'empty',
                title: node.label,
                sourceNodeId: node.id,
                breadcrumb: [connection?.label, scope.instanceLabel].filter(Boolean).join(' / '),
                comment: result.sql,
                fields: [{key: 'nodeType', value: 'view_model'}],
                listItems: [],
            })
        } catch {
            shortcutPanel.syncExplorerInfo({
                kind: 'empty',
                title: node.label,
                sourceNodeId: node.id,
                breadcrumb: [connection?.label, scope.instanceLabel].filter(Boolean).join(' / '),
                fields: [{key: 'nodeType', value: 'view_model'}],
                listItems: [],
            })
        }
    }

    async function syncExplorerInfoForNode(node: TreeNode) {
        if (!isExplorerInfoNode(node)) return
        const prepared = await prepareExplorerInfoNode(
            node,
            explorer.tree,
            (nodeId) => explorer.ensureChildrenLoaded(nodeId),
            (nodeId) => explorer.findNode(nodeId),
        )
        await explorer.prefetchSemanticMetricsForNode(prepared.id)
        const scope = findAncestorByType(explorer.tree, prepared.id, 'database')
        const connectionId = findConnectionId(prepared)
        const semanticIndex = connectionId && scope
            ? explorer.getSemanticIndex(connectionId, scope.label)
            : null
        shortcutPanel.syncExplorerInfo(buildExplorerNodeInfo(prepared, explorer.tree, semanticIndex))
    }

    function findConnectionId(node: TreeNode): string | undefined {
        return findAncestorByType(explorer.tree, node.id, 'connection')?.id
    }

    async function openViewModelDataFromNode(node: TreeNode) {
        const connectionId = findConnectionId(node)
        const scope = resolveViewModelScope(explorer.tree, node.id)
        if (!connectionId || !scope) return
        try {
            const result = await viewModelApi.read({
                connectionId,
                instanceName: scope.instanceLabel,
                name: node.label,
            })
            workspace.openViewModelData({
                viewModelName: node.label,
                viewModelSql: result.sql,
                connectionId,
                instanceId: scope.scopeNode.id,
                database: scope.instanceLabel,
                explorerNodeId: node.id,
            })
        } catch {
            layout.showToast(t('viewModel.loadFailed'))
        }
    }

    async function openViewModelConsoleFromNode(node: TreeNode) {
        const connectionId = findConnectionId(node)
        const scope = resolveViewModelScope(explorer.tree, node.id)
        if (!connectionId || !scope) return
        try {
            const result = await viewModelApi.read({
                connectionId,
                instanceName: scope.instanceLabel,
                name: node.label,
            })
            await workspace.openViewModelConsole({
                viewModelName: node.label,
                sql: result.sql,
                connectionId,
                connectionName: findConnectionLabel(connectionId),
                instanceId: scope.scopeNode.id,
                database: scope.instanceLabel,
                explorerNodeId: node.id,
            })
            layout.setModule('database')
        } catch {
            layout.showToast(t('viewModel.loadFailed'))
        }
    }

    async function openSqlFile(node: TreeNode) {
        try {
            await openSqlFileFromTree(explorer.tree, node)
        } catch {
            layout.showToast(t('console.loadSqlFileFailed'))
        }
    }

    async function onSelect(node: TreeNode) {
        if (node.type === 'load_more') {
            if (explorer.loadingNodeIds.has(node.id)) return
            await explorer.toggleExpand(node.id)
            return
        }
        if (isExplorerFavoritesViewAllNode(node)) {
            explorer.showAllFavoriteTables()
            return
        }
        if (isExplorerFavoritesGroupId(node.id)) {
            explorer.selectNode(node.id)
            return
        }
        explorer.selectNode(node.id)
        if (node.type === 'sql_file') {
            await openSqlFile(node)
            return
        }
        if (node.type === 'view_model') {
            await syncViewModelExplorerInfo(node)
            return
        }
        await syncExplorerInfoForNode(node)
    }

    async function onOpen(node: TreeNode) {
        if (isExplorerFavoritesViewAllNode(node)) {
            explorer.showAllFavoriteTables()
            return
        }
        if (isExplorerFavoritesGroupId(node.id)) {
            explorer.toggleFavoritesGroupExpanded()
            return
        }
        const favorite = shouldOpenFavoriteTable(node)
        if (favorite && !explorer.findNode(node.id)) {
            await openPinnedTableFavorite(favorite)
            return
        }
        explorer.selectNode(node.id)
        if (node.type === 'table' || node.type === 'view') {
            const favorite = shouldOpenFavoriteTable(node)
            if (favorite && !explorer.findNode(node.id)) {
                await openPinnedTableFavorite(favorite)
                return
            }
            openTableFromNode(node, 'data')
            return
        }
        const latest = explorer.findNode(node.id) ?? node
        if (shouldCollapseOnDoubleClick(latest)) {
            explorer.collapseNode(node.id)
            return
        }
        await explorer.expandPathToNode(node.id)
        if (node.type === 'sql_file') {
            await openSqlFile(node)
            return
        }
        if (node.type === 'view_model') {
            if (isViewModelDraftNode(node)) {
                await openViewModelConsoleFromNode(node)
            } else {
                await openViewModelDataFromNode(node)
            }
            return
        }
        if (node.type === 'platform_feature') {
            const connectionId = findConnectionId(node)
            const scope = resolveExplorerSqlFileScope(explorer.tree, node.id)
            if (!connectionId || !scope) return
            const feature = resolvePlatformFeatureId(node) as PlatformFeatureId
            workspace.openPlatformCatalog({
                feature,
                connectionId,
                database: scope.instanceLabel,
                instanceId: scope.scopeNode.id,
                explorerNodeId: node.id,
            })
            layout.setModule('database')
            return
        }
        if (node.type === 'redis-key') {
            const connectionId = findConnectionId(node)
            const key = connectionId ? parseRedisKeyFromNodeId(node.id, connectionId) : null
            if (!connectionId || !key) return
            workspace.openRedisKey({connectionId, key, explorerNodeId: node.id})
            return
        }
        if (node.type === 'redis-browser') {
            const connectionId = findConnectionId(node)
            if (!connectionId) return
            workspace.openRedisConsole({
                connectionId,
                connectionName: findConnectionLabel(connectionId) ?? connectionId,
                explorerNodeId: connectionId,
                view: 'keys',
            })
            return
        }
        if (node.type === 'redis-feature') {
            const connectionId = findConnectionId(node)
            if (!connectionId) return
            const feature = parseRedisFeatureId(node)
            const connectionName = findConnectionLabel(connectionId) ?? connectionId
            if (feature === 'keys') {
                workspace.openRedisConsole({
                    connectionId,
                    connectionName,
                    explorerNodeId: connectionId,
                    view: 'keys',
                })
            } else if (feature === 'command') {
                workspace.openRedisConsole({
                    connectionId,
                    connectionName,
                    explorerNodeId: connectionId,
                    view: 'command',
                })
            }
            return
        }
        if (node.type === 'kafka-topic') {
            const connectionId = findConnectionId(node)
            const topic = connectionId ? parseKafkaTopicFromNodeId(node.id, connectionId) : null
            if (!connectionId || !topic) return
            workspace.openKafkaTopic({
                connectionId,
                connectionName: findConnectionLabel(connectionId) ?? connectionId,
                explorerNodeId: connectionId,
                topic,
            })
            return
        }
        if (node.type === 'kafka-feature') {
            const connectionId = findConnectionId(node)
            if (!connectionId) return
            const feature = parseKafkaFeatureId(node)
            const connectionName = findConnectionLabel(connectionId) ?? connectionId
            if (feature === 'topics') {
                workspace.openKafkaTopics({
                    connectionId,
                    connectionName,
                    explorerNodeId: connectionId,
                })
            } else if (feature === 'consumer-groups') {
                workspace.openKafkaConsumerGroups({
                    connectionId,
                    connectionName,
                    explorerNodeId: connectionId,
                })
            }
            return
        }
        if (node.type === 'connection') {
            await explorer.expandAndLoad(node.id, {notify: true})
            await syncExplorerInfoForNode(explorer.findNode(node.id) ?? node)
            return
        }
        if (node.type === 'database') {
            const connectionId = findConnectionId(node)
            if (!connectionId) return
            try {
                await openLatestSqlEditor(explorer.tree, node, findConnectionLabel(connectionId))
            } catch {
                layout.showToast(t('console.loadSqlFileFailed'))
            }
        }
    }

    function findDatabaseId(node: TreeNode): string | undefined {
        if (node.type === 'database') return node.id
        const database = findAncestorByType(explorer.tree, node.id, 'database')
        return database?.id
    }

    function findConnectionLabel(connectionId?: string): string | undefined {
        if (!connectionId) return undefined
        return explorer.findNode(connectionId)?.label
    }

    function buildConnectionMenuItems(node: TreeNode): ContextMenuItem[] {
        const state = resolveConnectionLinkState(
            node.id,
            explorer.connectionHealthById,
            explorer.loadingNodeIds,
        )
        const lifecycleItems = buildConnectionLifecycleMenuItems(t, state)
        const moveTargets = listConnectionMoveTargets(explorer.tree, node.id)
        const withMove = (items: ContextMenuItem[]) =>
            injectConnectionMoveSubmenu(items, moveTargets, t('explorer.context.moveConnection'))
        if (node.dbType === 'redis') {
            return prependConnectionLifecycleMenu(withMove([
                {id: 'open-redis-keys', label: t('explorer.context.openRedisKeys'), icon: 'open'},
                {id: 'open-redis-command', label: t('explorer.context.openRedisCommand'), icon: 'console'},
                {id: 'edit', label: t('explorer.context.editConnection'), icon: 'edit', shortcut: 'F4'},
                {id: 'move', label: t('explorer.context.moveConnection'), icon: 'file'},
                {id: 'copy-name', label: t('explorer.context.copyName'), icon: 'copy'},
                {id: 'divider-1', label: '', divider: true},
                {id: 'delete', label: t('explorer.context.deleteConnection'), icon: 'delete', shortcut: 'Delete', danger: true},
            ]), lifecycleItems)
        }
        if (node.dbType === 'kafka') {
            return prependConnectionLifecycleMenu(withMove([
                {id: 'open-kafka-topics', label: t('explorer.context.openKafkaTopics'), icon: 'open'},
                {id: 'open-kafka-consumer-groups', label: t('explorer.context.openKafkaConsumerGroups'), icon: 'open'},
                {id: 'edit', label: t('explorer.context.editConnection'), icon: 'edit', shortcut: 'F4'},
                {id: 'move', label: t('explorer.context.moveConnection'), icon: 'file'},
                {id: 'copy-name', label: t('explorer.context.copyName'), icon: 'copy'},
                {id: 'divider-1', label: '', divider: true},
                {id: 'delete', label: t('explorer.context.deleteConnection'), icon: 'delete', shortcut: 'Delete', danger: true},
            ]), lifecycleItems)
        }
        return prependConnectionLifecycleMenu(
            withMove(filterSqlContextMenuItems(
                getContextMenuForNodeType('connection', t),
                node.dbType,
                catalogStore.items,
            )),
            lifecycleItems,
        )
    }

    function buildGroupMenuItems(node: TreeNode): ContextMenuItem[] {
        const items = getContextMenuForNodeType('group', t)
        const selected = explorer.selectedNode
        if (
            selected?.type === 'connection'
            && canMoveConnectionToGroup(explorer.tree, selected.id, node.id)
        ) {
            return [
                {
                    id: 'move-here',
                    label: t('explorer.context.moveConnectionHere', {name: selected.label}),
                    icon: 'file',
                },
                {id: 'divider-move', label: '', divider: true},
                ...items,
            ]
        }
        return items
    }

    async function performMoveConnection(connectionId: string, targetGroupId: string) {
        const connection = explorer.findNode(connectionId)
        const targetGroup = explorer.findNode(targetGroupId)
        if (!connection || connection.type !== 'connection') return
        if (!canMoveConnectionToGroup(explorer.tree, connectionId, targetGroupId)) return
        try {
            await explorer.moveConnection(connectionId, targetGroupId)
            layout.showToast(t('explorer.connectionMoved', {
                name: connection.label,
                folder: targetGroup?.label ?? targetGroupId,
            }))
        } catch {
            layout.showToast(t('explorer.moveConnectionFailed'))
        }
    }

    function buildPinContextMenuItems(node: TreeNode, items: ContextMenuItem[]): ContextMenuItem[] {
        if (!isPinnableExplorerNode(node)) return items

        const pinned = explorer.isNodePinned(node.id)
        const pinLabel = node.type === 'table'
            ? t(pinned ? 'explorer.context.unfavoriteTable' : 'explorer.context.favoriteTable')
            : t(pinned ? 'explorer.context.unpinFromTop' : 'explorer.context.pinToTop')

        if (node.type === 'table') {
            return items.map((item) => item.id === 'pin' ? {...item, label: pinLabel} : item)
        }

        const pinItem: ContextMenuItem = {
            id: 'pin',
            label: pinLabel,
            icon: 'pin',
        }
        return [
            pinItem,
            {id: 'divider-pin', label: '', divider: true},
            ...items.filter((item) => item.id !== 'pin'),
        ]
    }

    function onContextMenu(e: MouseEvent, node: TreeNode) {
        if (isExplorerFavoritesTreeNode(node)) return
        explorer.selectNode(node.id)
        let items = getContextMenuForNodeType(node.type, t)
        if (node.type === 'folder' && node.label === 'models') {
            items = getContextMenuForNodeType('folder-models', t)
        }
        if (node.type === 'folder' && node.label === 'tables') {
            items = getContextMenuForNodeType('folder-tables', t)
        }
        if (node.type === 'table') {
            const ctx = resolveTableContext(explorer.tree, node)
            if (!isCsvImportSupported(ctx?.dbType, catalogStore.items)) {
                items = items.filter((item) => item.id !== 'import')
            }
        }
        if (node.type === 'connection') {
            items = buildConnectionMenuItems(node)
        }
        if (node.type === 'group') {
            items = buildGroupMenuItems(node)
        }
        const connectionDbType = resolveConnectionDbType(explorer.tree, node.id)
        if (node.type === 'database' || node.type === 'table') {
            items = filterConnectionCapabilityMenuItems(items, connectionDbType, catalogStore.items)
        }
        items = filterPluginGatedMenuItems(items, (id) => usePluginStore().isEnabled(id))
        items = buildPinContextMenuItems(node, items)
        menuItems.value = items
        open(e, node)
    }

    function openTableFromNode(node: TreeNode, tableView?: 'properties' | 'data' | 'ddl') {
        const ctx = resolveTableContext(explorer.tree, node)
        if (!ctx) return
        const catalogNode = findAncestorByType(explorer.tree, node.id, 'database')
        workspace.openTable(
            ctx.tableName,
            ctx.connectionId,
            catalogNode?.id,
            ctx.database,
            ctx.nodeId,
            tableView,
            node.type === 'view' ? 'view' : 'table',
        )
    }

    function openSqlExportWizard(node: TreeNode) {
        const ctx = resolveExplorerSqlExportContext(explorer.tree, node)
        if (!ctx) {
            layout.showToast(t('explorer.exportSqlContextMissing'))
            return
        }
        const connectionLabel = findConnectionLabel(ctx.connectionId)
        if (node.type === 'table') {
            sqlExportWizardContext.value = {
                ...ctx,
                scope: 'table',
                connectionLabel,
            }
        } else {
            sqlExportWizardContext.value = {
                ...ctx,
                scope: 'database',
                connectionLabel,
                tableCount: countTablesUnderDatabase(explorer.tree, node.id),
            }
        }
        showSqlExportWizard.value = true
    }

    async function confirmSqlExportWizardExport(form: SqlExportWizardForm) {
        const ctx = sqlExportWizardContext.value
        if (!ctx) return
        sqlExportWizardExporting.value = true
        try {
            const result = await runSqlExportWizard(ctx, form, tableDetailApi)
            const outcome = await applySqlExportWizardOutput(result, form.output)
            if (outcome === 'empty') {
                layout.showToast(t('explorer.exportSqlFailed'))
                return
            }
            if (outcome === 'downloaded') {
                layout.startExport(result.fileName)
                layout.showToast(t('explorer.exportSqlSuccess', {name: result.fileName}))
            } else {
                layout.showToast(t('explorer.exportSqlCopied'))
            }
            showSqlExportWizard.value = false
        } catch {
            layout.showToast(t('explorer.exportSqlFailed'))
        } finally {
            sqlExportWizardExporting.value = false
        }
    }

    function openTableMigrationFromNode(node: TreeNode) {
        const ctx = resolveTableMigrationContext(explorer.tree, node)
        if (!ctx) {
            layout.showToast(t('explorer.tableMigrationContextMissing'))
            return
        }
        layout.setModule('database')
        workspace.openTableMigration({
            source: ctx.source,
            preselectedTables: ctx.preselectedTables,
        })
    }

    async function handleSqlExportAction(node: TreeNode, action: ExplorerSqlExportAction) {
        const ctx = resolveExplorerSqlExportContext(explorer.tree, node)
        if (!ctx) {
            layout.showToast(t('explorer.exportSqlContextMissing'))
            return
        }
        try {
            const includeData = includeDataForExportAction(action)
            const result = ctx.tableName
                ? await tableDetailApi.exportTableSql(ctx.tableName, {
                    connectionId: ctx.connectionId,
                    database: ctx.database,
                    includeData,
                })
                : await tableDetailApi.exportDatabaseSql({
                    connectionId: ctx.connectionId,
                    database: ctx.database,
                    includeData,
                })
            if (shouldDownloadExportAction(action)) {
                downloadSqlFile(result.sql, result.fileName)
                layout.showToast(t('explorer.exportSqlSuccess', {name: result.fileName}))
                return
            }
            const copied = await copySqlToClipboard(result.sql)
            if (copied) {
                layout.showToast(t('explorer.exportSqlCopied'))
            } else {
                layout.showToast(t('explorer.exportSqlFailed'))
            }
        } catch {
            layout.showToast(t('explorer.exportSqlFailed'))
        }
    }

    async function openMetadataDocFromNode(node: TreeNode) {
        const ctx = resolveExplorerSqlExportContext(explorer.tree, node)
        if (!ctx || node.type !== 'database') {
            layout.showToast(t('explorer.metadocContextMissing'))
            return
        }
        layout.setModule('database')
        workspace.openMetadataDoc({
            connectionId: ctx.connectionId,
            database: ctx.database,
            explorerNodeId: node.id,
            title: t('workspace.metadoc.tabTitle', {database: ctx.database}),
            loading: true,
            detailsLoading: false,
        })
        try {
            // Phase 1: fast summary (table list only)
            const summary = await tableDetailApi.previewDatabaseMetadoc({
                connectionId: ctx.connectionId,
                database: ctx.database,
                format: 'md',
                includeDetails: false,
            })
            workspace.openMetadataDoc({
                connectionId: ctx.connectionId,
                database: ctx.database,
                explorerNodeId: node.id,
                title: t('workspace.metadoc.tabTitle', {database: ctx.database}),
                html: summary.html,
                markdown: summary.markdown,
                fileName: summary.fileName,
                loading: false,
                detailsLoading: true,
            })

            // Phase 2: full details (runs in background, updates the tab when ready)
            void tableDetailApi.previewDatabaseMetadoc({
                connectionId: ctx.connectionId,
                database: ctx.database,
                format: 'md',
                includeDetails: true,
            }).then((full) => {
                workspace.openMetadataDoc({
                    connectionId: ctx.connectionId,
                    database: ctx.database,
                    explorerNodeId: node.id,
                    title: t('workspace.metadoc.tabTitle', {database: ctx.database}),
                    html: full.html,
                    markdown: full.markdown,
                    fileName: full.fileName,
                    loading: false,
                    detailsLoading: false,
                })
            }).catch(() => {
                workspace.openMetadataDoc({
                    connectionId: ctx.connectionId,
                    database: ctx.database,
                    explorerNodeId: node.id,
                    title: t('workspace.metadoc.tabTitle', {database: ctx.database}),
                    loading: false,
                    detailsLoading: false,
                })
            })
        } catch (e) {
            const message = e instanceof Error ? e.message : t('explorer.metadocFailed')
            workspace.openMetadataDoc({
                connectionId: ctx.connectionId,
                database: ctx.database,
                explorerNodeId: node.id,
                title: t('workspace.metadoc.tabTitle', {database: ctx.database}),
                loading: false,
                detailsLoading: false,
                loadError: message,
            })
            layout.showToast(t('explorer.metadocFailed'))
        }
    }

    async function openConsoleForTableNode(node: TreeNode) {
        const databaseNode = findAncestorByType(explorer.tree, node.id, 'database')
        const connectionId = findConnectionId(node)
        if (!databaseNode || !connectionId) {
            layout.showToast(t('explorer.tableActionContextMissing'))
            return
        }
        try {
            await openBlankSqlConsole(explorer.tree, databaseNode, findConnectionLabel(connectionId))
        } catch {
            layout.showToast(t('console.loadSqlFileFailed'))
        }
    }

    async function handleExportTableData(node: TreeNode) {
        const ctx = resolveTableContext(explorer.tree, node)
        if (!ctx) {
            layout.showToast(t('explorer.tableActionContextMissing'))
            return
        }
        try {
            const data = await tableDataApi.fetch(ctx.tableName, {
                connectionId: ctx.connectionId,
                database: ctx.database,
                maxRows: resolveClientMaxResultRows(),
            })
            if (!data.rows.length) {
                layout.showToast(t('explorer.exportDataEmpty'))
                return
            }
            const fileName = await exportTableDataCsv(ctx.tableName, data.columns, data.rows)
            layout.startExport(fileName)
            layout.showToast(t('explorer.exportDataSuccess', {name: fileName}))
        } catch {
            layout.showToast(t('explorer.exportDataFailed'))
        }
    }

    async function handleImportTableData(node: TreeNode) {
        const ctx = resolveTableContext(explorer.tree, node)
        if (!ctx) {
            layout.showToast(t('explorer.tableActionContextMissing'))
            return
        }

        const file = await pickSpreadsheetFile()
        if (!file) {
            layout.showToast(t('explorer.importDataCancelled'))
            return
        }

        try {
            const parsed = await parseSpreadsheetFile(file)
            if (!parsed.headers.length || !parsed.rows.length) {
                layout.showToast(t('explorer.importDataEmpty'))
                return
            }

            const statements = buildInsertStatementsFromCsv(ctx, parsed.headers, parsed.rows)
            if (!statements.length) {
                layout.showToast(t('explorer.importDataEmpty'))
                return
            }

            const result = await executeSqlBatch(statements, {
                connectionId: ctx.connectionId,
                database: ctx.database,
            }, undefined, {
                isPluginEnabled: (pluginId) => usePluginStore().isEnabled(pluginId),
            })

            if (result.lastErrorMessage) {
                layout.showErrorToast(result.lastErrorMessage)
                return
            }

            layout.showToast(
                t('explorer.importDataSuccess', {
                    count: parsed.rows.length,
                    name: ctx.tableName,
                }),
            )
        } catch {
            layout.showToast(t('explorer.importDataFailed'))
        }
    }

    async function confirmTableAction() {
        const pending = pendingTableAction.value
        if (!pending) return

        const ctx = resolveTableContext(explorer.tree, pending.node)
        if (!ctx) {
            layout.showToast(t('explorer.tableActionContextMissing'))
            return
        }

        const databaseNode = findAncestorByType(explorer.tree, pending.node.id, 'database')
        const sql =
            pending.type === 'truncate'
                ? buildTruncateTableSql(ctx)
                : buildDropTableSql(ctx)

        try {
            await sqlApi.execute(sql, {
                connectionId: ctx.connectionId,
                database: ctx.database,
            })

            if (pending.type === 'delete') {
                workspace.closeTableTabs({
                    connectionId: ctx.connectionId,
                    database: ctx.database,
                    tableName: ctx.tableName,
                })
                if (explorer.selectedNodeId === pending.node.id && databaseNode) {
                    explorer.selectNode(databaseNode.id)
                }
            }

            await explorer.reloadTablesFolder(
                ctx.connectionId,
                ctx.database,
                databaseNode?.id,
            )

            layout.showToast(
                t(
                    pending.type === 'truncate'
                        ? 'explorer.truncateTableSuccess'
                        : 'explorer.deleteTableSuccess',
                    {name: ctx.tableName},
                ),
            )
        } catch (error) {
            const message = error instanceof Error ? error.message : undefined
            layout.showErrorToast(
                message
                ?? t(
                    pending.type === 'truncate'
                        ? 'explorer.truncateTableFailed'
                        : 'explorer.deleteTableFailed',
                ),
            )
        } finally {
            pendingTableAction.value = null
            showTableActionDialog.value = false
        }
    }

    function onMenuSelect(id: string) {
        const node = contextNode.value
        if (!node) return

        const dbType = parseDbTypeMenuId(id)
        if (dbType) {
            if (node.type === 'group') {
                workspace.openConnectionForm(dbType, {groupId: node.id})
            } else {
                workspace.openConnectionForm(dbType)
            }
            closeMenu()
            return
        }

        if (id === 'new-subgroup' && node.type === 'group') {
            pendingGroupNode.value = node
            showSubgroupDialog.value = true
            closeMenu()
            return
        }

        if (id === 'rename' && node.type === 'group') {
            pendingGroupNode.value = node
            renameDefaultName.value = node.label
            showRenameDialog.value = true
            closeMenu()
            return
        }

        if (id === 'rename' && node.type === 'sql_file') {
            pendingSqlFileNode.value = node
            renameSqlDefaultName.value = stripSqlExtension(node.label)
            showRenameSqlDialog.value = true
            closeMenu()
            return
        }

        if (id === 'delete-sql-file' && node.type === 'sql_file') {
            pendingSqlFileNode.value = node
            deleteSqlMessage.value = t('explorer.deleteSqlFileMessage', {name: node.label})
            showDeleteSqlDialog.value = true
            closeMenu()
            return
        }

        if (id === 'script-history' && node.type === 'sql_file') {
            const connectionId = findConnectionId(node)
            const scope = resolveExplorerSqlFileScope(explorer.tree, node.id)
            if (!connectionId || !scope) {
                closeMenu()
                return
            }
            const connectionNode = explorer.findNode(connectionId)
            useScriptHistoryDrawerStore().openDrawer({
                connectionId,
                instanceName: scope.instanceLabel,
                fileName: node.label,
                connectionLabel: connectionNode?.label,
            })
            closeMenu()
            return
        }

        if (id === 'open') void onOpen(node)

        if (id === 'connect' && node.type === 'connection') {
            void explorer.connectConnection(node.id, {notify: true})
                .then((ok) => {
                    if (ok) layout.showToast(t('explorer.connectionOpened', {name: node.label}))
                })
            closeMenu()
            return
        }

        if (id === 'disconnect' && node.type === 'connection') {
            void explorer.disconnectConnection(node.id)
                .then((ok) => {
                    if (ok) layout.showToast(t('explorer.connectionDisconnected', {name: node.label}))
                    else layout.showToast(t('explorer.connectionDisconnectFailed'))
                })
            closeMenu()
            return
        }

        if (id === 'reconnect' && node.type === 'connection') {
            void explorer.reconnectConnection(node.id, {notify: true})
                .then((ok) => {
                    if (ok) layout.showToast(t('explorer.connectionReconnected', {name: node.label}))
                })
            closeMenu()
            return
        }

        if (id === 'open-redis-browser' && node.type === 'connection' && node.dbType === 'redis') {
            workspace.openRedisConsole({
                connectionId: node.id,
                connectionName: node.label,
                explorerNodeId: node.id,
                view: 'keys',
            })
            closeMenu()
            return
        }

        if (id === 'open-redis-keys' && node.type === 'connection' && node.dbType === 'redis') {
            workspace.openRedisConsole({
                connectionId: node.id,
                connectionName: node.label,
                explorerNodeId: node.id,
                view: 'keys',
            })
            closeMenu()
            return
        }

        if (id === 'open-redis-command' && node.type === 'connection' && node.dbType === 'redis') {
            workspace.openRedisConsole({
                connectionId: node.id,
                connectionName: node.label,
                explorerNodeId: node.id,
                view: 'command',
            })
            closeMenu()
            return
        }

        if (id === 'redis-console' && node.type === 'connection' && node.dbType === 'redis') {
            workspace.openRedisConsole({
                connectionId: node.id,
                connectionName: node.label,
                explorerNodeId: node.id,
                view: 'keys',
            })
            closeMenu()
            return
        }

        if (id === 'open-kafka-topics' && node.type === 'connection' && node.dbType === 'kafka') {
            workspace.openKafkaTopics({
                connectionId: node.id,
                connectionName: node.label,
                explorerNodeId: node.id,
            })
            closeMenu()
            return
        }

        if (id === 'open-kafka-consumer-groups' && node.type === 'connection' && node.dbType === 'kafka') {
            workspace.openKafkaConsumerGroups({
                connectionId: node.id,
                connectionName: node.label,
                explorerNodeId: node.id,
            })
            closeMenu()
            return
        }

        if (id === 'kafka-console' && node.type === 'connection' && node.dbType === 'kafka') {
            workspace.openKafkaTopics({
                connectionId: node.id,
                connectionName: node.label,
                explorerNodeId: node.id,
            })
            closeMenu()
            return
        }

        if (id === 'export-wizard' && (node.type === 'table' || node.type === 'database')) {
            openSqlExportWizard(node)
            closeMenu()
            return
        }

        if (
            id === 'export-structure' ||
            id === 'export-all' ||
            id === 'copy-structure' ||
            id === 'copy-data'
        ) {
            if (node.type === 'table' || node.type === 'database') {
                void handleSqlExportAction(node, id as ExplorerSqlExportAction)
            }
            closeMenu()
            return
        }

        if (id === 'export-metadoc' && node.type === 'database') {
            void openMetadataDocFromNode(node)
            closeMenu()
            return
        }

        if (id === 'ddl' && node.type === 'table') {
            explorer.selectNode(node.id)
            openTableFromNode(node, 'ddl')
            closeMenu()
            return
        }

        if (id === 'schema-er' && node.type === 'folder' && node.label === 'tables') {
            const ctx = resolveExplorerSchemaErContext(explorer.tree, node)
            if (!ctx) {
                layout.showToast(t('explorer.schemaErContextMissing'))
                closeMenu()
                return
            }
            layout.setModule('database')
            workspace.openSchemaEr(ctx)
            closeMenu()
            return
        }

        if (id === 'schema-tables' && node.type === 'folder' && node.label === 'tables') {
            const ctx = resolveExplorerSchemaErContext(explorer.tree, node)
            if (!ctx) {
                layout.showToast(t('explorer.schemaTablesContextMissing'))
                closeMenu()
                return
            }
            layout.setModule('database')
            workspace.openSchemaTables(ctx)
            closeMenu()
            return
        }

        if (id === 'pin' && isPinnableExplorerNode(node)) {
            const pinned = explorer.togglePinnedNode(node.id)
            const messageKey = node.type === 'table'
                ? (pinned ? 'explorer.tableFavorited' : 'explorer.tableUnfavorited')
                : node.type === 'connection'
                    ? (pinned ? 'explorer.connectionPinned' : 'explorer.connectionUnpinned')
                    : (pinned ? 'explorer.databasePinned' : 'explorer.databaseUnpinned')
            layout.showToast(t(messageKey, {name: node.label}))
            closeMenu()
            return
        }

        if (id === 'edit' && node.type === 'table') {
            explorer.selectNode(node.id)
            openTableFromNode(node, 'properties')
            closeMenu()
            return
        }

        if (id === 'truncate' && node.type === 'table') {
            pendingTableAction.value = {
                type: 'truncate',
                node,
                message: t('explorer.truncateTableMessage', {name: node.label}),
            }
            showTableActionDialog.value = true
            closeMenu()
            return
        }

        if (id === 'import' && node.type === 'table') {
            const ctx = resolveTableContext(explorer.tree, node)
            if (!isCsvImportSupported(ctx?.dbType, catalogStore.items)) {
                closeMenu()
                return
            }
            void handleImportTableData(node)
            closeMenu()
            return
        }

        if (id === 'export-data' && node.type === 'table') {
            void handleExportTableData(node)
            closeMenu()
            return
        }

        if (id === 'run-sql-file' && node.type === 'database') {
            const connectionId = findConnectionId(node)
            void runSqlFileForDatabase(explorer.tree, node, findConnectionLabel(connectionId))
                .catch(() => layout.showErrorToast(t('explorer.runSqlFileFailed')))
            closeMenu()
            return
        }

        if (id === 'schema-compare' && node.type === 'database') {
            const scope = resolveSchemaScopeFromDatabaseNode(explorer.tree, node)
            if (scope) workspace.openSchemaCompare({left: scope})
            closeMenu()
            return
        }

        if (id === 'cross-env-compare' && node.type === 'database') {
            const scope = resolveSchemaScopeFromDatabaseNode(explorer.tree, node)
            if (scope) workspace.openCrossEnvCompare({left: scope})
            closeMenu()
            return
        }

        if (id === 'migrate-data' && (node.type === 'database' || node.type === 'table')) {
            openTableMigrationFromNode(node)
            closeMenu()
            return
        }

        if (id === 'migrate-data' && node.type === 'view_model') {
            void openViewModelMigrationFromNode(node)
            closeMenu()
            return
        }

        if (id === 'new-view-model' && node.type === 'folder' && node.label === 'models') {
            const scope = resolveViewsFolderScope(explorer.tree, node.id)
            if (scope?.connectionId) {
                layout.setModule('database')
                void workspace.openViewModelEditor({
                    connectionId: scope.connectionId,
                    instanceId: scope.scopeNode.id,
                    database: scope.instanceLabel,
                })
            }
            closeMenu()
            return
        }

        if (id === 'edit-view-model' && node.type === 'view_model') {
            void openViewModelConsoleFromNode(node)
            closeMenu()
            return
        }

        if (id === 'view-lineage' && node.type === 'view_model') {
            const connectionId = findConnectionId(node)
            const scope = resolveViewModelScope(explorer.tree, node.id)
            if (!connectionId || !scope) {
                layout.showToast(t('lineage.missingContext'))
                closeMenu()
                return
            }
            layout.setModule('database')
            workspace.openViewModelLineage({
                viewModelName: node.label,
                connectionId,
                instanceId: scope.scopeNode.id,
                database: scope.instanceLabel,
                explorerNodeId: node.id,
            })
            closeMenu()
            return
        }

        if (id === 'rename' && node.type === 'view_model') {
            pendingViewModelNode.value = node
            renameViewModelDefaultName.value = node.label
            showRenameViewModelDialog.value = true
            closeMenu()
            return
        }

        if (id === 'delete-view-model' && node.type === 'view_model') {
            pendingViewModelNode.value = node
            deleteViewModelMessage.value = t('viewModel.deleteMessage', {name: node.label})
            showDeleteViewModelDialog.value = true
            closeMenu()
            return
        }

        if (id === 'sql-editor-open' && node.type === 'database') {
            const connectionId = findConnectionId(node)
            if (connectionId) {
                void openLatestSqlEditor(explorer.tree, node, findConnectionLabel(connectionId))
                    .catch(() => layout.showToast(t('console.loadSqlFileFailed')))
            }
            closeMenu()
            return
        }

        if (id === 'sql-editor-recent' && node.type === 'database') {
            const connectionId = findConnectionId(node)
            if (connectionId) {
                void buildDatabaseConsoleContext(explorer.tree, node, findConnectionLabel(connectionId))
                    .then((ctx) => {
                        if (!ctx) return
                        recentSqlContext.value = ctx
                        showRecentSqlDialog.value = true
                    })
            }
            closeMenu()
            return
        }

        if (id === 'sql-editor-new' && node.type === 'database') {
            const connectionId = findConnectionId(node)
            if (connectionId) {
                void createNewSqlEditor(explorer.tree, node, findConnectionLabel(connectionId))
                    .then(() => explorer.reloadWorkspacesFolder(connectionId, node.label))
                    .catch(() => layout.showToast(t('console.loadSqlFileFailed')))
            }
            closeMenu()
            return
        }

        if (id === 'sql-editor-console' && node.type === 'database') {
            const connectionId = findConnectionId(node)
            if (connectionId) {
                void openBlankSqlConsole(explorer.tree, node, findConnectionLabel(connectionId))
                    .catch(() => layout.showToast(t('console.loadSqlFileFailed')))
            }
            closeMenu()
            return
        }

        if (id === 'console') {
            if (node.type === 'database') {
                const connectionId = findConnectionId(node)
                if (connectionId) {
                    void openLatestSqlEditor(explorer.tree, node, findConnectionLabel(connectionId))
                        .catch(() => layout.showToast(t('console.loadSqlFileFailed')))
                }
            } else if (node.type === 'table') {
                void openConsoleForTableNode(node)
            } else {
                workspace.openConsole({
                    connectionName: node.label,
                    connectionId: node.type === 'connection' ? node.id : undefined,
                })
            }
        }
        const moveTargetGroupId = parseMoveTargetMenuId(id)
        if (moveTargetGroupId && node.type === 'connection') {
            void performMoveConnection(node.id, moveTargetGroupId)
            closeMenu()
            return
        }

        if (id === 'move-here' && node.type === 'group') {
            const connection = explorer.selectedNode
            if (connection?.type === 'connection') {
                void performMoveConnection(connection.id, node.id)
            }
            closeMenu()
            return
        }

        if (id === 'edit' && node.type === 'connection' && node.dbType) {
            workspace.openConnectionForm(node.dbType, {
                connectionId: node.id,
                connectionName: node.label,
            })
        }
        if (id === 'delete' && node.type === 'table') {
            pendingTableAction.value = {
                type: 'delete',
                node,
                message: t('explorer.deleteTableMessage', {name: node.label}),
            }
            showTableActionDialog.value = true
            closeMenu()
            return
        }
        if (id === 'delete') {
            const label = node.label
            void explorer.deleteNode(node.id)
                .then(() => {
                    if (node.type === 'group') {
                        layout.showToast(t('explorer.groupDeleted', {name: label}))
                    }
                })
                .catch(() => {
                    layout.showToast(t('explorer.deleteFailed'))
                })
        }
        if (id === 'copy-name') {
            void navigator.clipboard.writeText(node.label)
        }
        closeMenu()
    }

    async function confirmRenameGroup(name: string) {
        const node = pendingGroupNode.value
        if (!node || node.type !== 'group') return
        try {
            await explorer.renameGroup(node.id, name)
            layout.showToast(t('explorer.groupRenamed', {name}))
        } catch {
            layout.showToast(t('explorer.createFailed'))
        }
    }

    async function confirmRenameSqlFile(name: string) {
        const node = pendingSqlFileNode.value
        if (!node || node.type !== 'sql_file') return

        const newBaseName = sqlFileNameFromTabLabel(name)
        if (!newBaseName) {
            layout.showToast(t('explorer.invalidSqlFileName'))
            return
        }

        const connectionId = findConnectionId(node)
        const scope = resolveExplorerSqlFileScope(explorer.tree, node.id)
        if (!connectionId || !scope) {
            layout.showToast(t('explorer.renameSqlFileFailed'))
            return
        }

        if (newBaseName === stripSqlExtension(node.label)) {
            return
        }

        try {
            const result = await instanceSqlApi.rename({
                connectionId,
                instanceName: scope.instanceLabel,
                oldFileName: node.label,
                newFileName: newBaseName,
            })
            await explorer.reloadWorkspacesFolder(
                connectionId,
                scope.instanceLabel,
                scope.scopeNode.id,
            )
            workspace.updateConsoleSqlFile({
                connectionId,
                instanceId: scope.scopeNode.id,
                oldFileName: node.label,
                newFileName: result.fileName,
                connectionName: findConnectionLabel(connectionId),
            })
            layout.showToast(t('explorer.sqlFileRenamed', {name: result.fileName}))
        } catch {
            layout.showToast(t('explorer.renameSqlFileFailed'))
        }
    }

    async function confirmDeleteSqlFile() {
        const node = pendingSqlFileNode.value
        if (!node || node.type !== 'sql_file') return

        const connectionId = findConnectionId(node)
        const scope = resolveExplorerSqlFileScope(explorer.tree, node.id)
        if (!connectionId || !scope) {
            layout.showToast(t('explorer.deleteSqlFileFailed'))
            return
        }

        try {
            await deleteInstanceSqlScript({
                connectionId,
                instanceName: scope.instanceLabel,
                fileName: node.label,
            })
            workspace.closeConsoleTabsForSqlFile({
                connectionId,
                instanceId: scope.scopeNode.id,
                fileName: node.label,
            })
            await explorer.reloadWorkspacesFolder(
                connectionId,
                scope.instanceLabel,
                scope.scopeNode.id,
            )
            if (explorer.selectedNodeId === node.id) {
                explorer.selectNode(scope.scopeNode.id)
            }
            layout.showToast(t('explorer.sqlFileDeleted', {name: node.label}))
        } catch {
            layout.showToast(t('explorer.deleteSqlFileFailed'))
        }
    }

    async function openViewModelMigrationFromNode(node: TreeNode) {
        const connectionId = findConnectionId(node)
        const scope = resolveViewModelScope(explorer.tree, node.id)
        if (!connectionId || !scope) {
            layout.showToast(t('explorer.tableMigrationContextMissing'))
            return
        }
        try {
            const result = await viewModelApi.read({
                connectionId,
                instanceName: scope.instanceLabel,
                name: node.label,
            })
            const migrationCtx = resolveTableMigrationContext(explorer.tree, scope.scopeNode)
            if (!migrationCtx) {
                layout.showToast(t('explorer.tableMigrationContextMissing'))
                return
            }
            pendingViewModelNode.value = node
            pendingMigrateViewModelSql.value = result.sql
            migrateViewModelTargetTable.value = ''
            showMigrateViewModelDialog.value = true
        } catch {
            layout.showToast(t('viewModel.loadFailed'))
        }
    }

    async function confirmMigrateViewModel(targetTable: string) {
        const node = pendingViewModelNode.value
        const sql = pendingMigrateViewModelSql.value
        const tableName = targetTable.trim()
        if (!node || !sql || !tableName) return

        const connectionId = findConnectionId(node)
        const scope = resolveViewModelScope(explorer.tree, node.id)
        const migrationCtx = scope ? resolveTableMigrationContext(explorer.tree, scope.scopeNode) : null
        if (!connectionId || !scope || !migrationCtx) return

        layout.setModule('database')
        workspace.openViewModelMigration({
            source: migrationCtx.source,
            viewModelName: node.label,
            sourceSelectSql: sql,
            targetTableName: tableName,
        })
        showMigrateViewModelDialog.value = false
    }

    async function confirmRenameViewModel(name: string) {
        const node = pendingViewModelNode.value
        if (!node || node.type !== 'view_model') return
        const trimmed = stripViewModelDisplayName(name)
        if (!trimmed || trimmed === node.label) return
        if (!isValidViewModelBaseName(trimmed)) {
            layout.showToast(t('viewModel.invalidName'))
            return
        }

        const connectionId = findConnectionId(node)
        const scope = resolveViewModelScope(explorer.tree, node.id)
        if (!connectionId || !scope) {
            layout.showToast(t('viewModel.renameFailed'))
            return
        }

        try {
            const result = await viewModelApi.rename({
                connectionId,
                instanceName: scope.instanceLabel,
                oldName: node.label,
                newName: trimmed,
            })
            await explorer.reloadViewsFolder(connectionId, scope.instanceLabel, scope.scopeNode.id)
            layout.showToast(t('viewModel.renamed', {name: result.name}))
        } catch {
            layout.showToast(t('viewModel.renameFailed'))
        }
    }

    async function confirmDeleteViewModel() {
        const node = pendingViewModelNode.value
        if (!node || node.type !== 'view_model') return

        const connectionId = findConnectionId(node)
        const scope = resolveViewModelScope(explorer.tree, node.id)
        if (!connectionId || !scope) {
            layout.showToast(t('viewModel.deleteFailed'))
            return
        }

        try {
            await viewModelApi.delete({
                connectionId,
                instanceName: scope.instanceLabel,
                name: node.label,
            })
            await explorer.reloadViewsFolder(connectionId, scope.instanceLabel, scope.scopeNode.id)
            if (explorer.selectedNodeId === node.id) {
                explorer.selectNode(scope.scopeNode.id)
            }
            layout.showToast(t('viewModel.deleted', {name: node.label}))
        } catch {
            layout.showToast(t('viewModel.deleteFailed'))
        }
    }

    async function confirmCreateSubgroup(name: string) {
        const node = pendingGroupNode.value
        if (!node || node.type !== 'group') return
        try {
            await explorer.addGroup(name, node.id)
            layout.showToast(t('explorer.subgroupCreated', {name}))
        } catch {
            layout.showToast(t('explorer.createFailed'))
        }
    }

    function isExplorerDialogOpen(): boolean {
        return (
            menuVisible.value ||
            showRenameDialog.value ||
            showRenameSqlDialog.value ||
            showDeleteSqlDialog.value ||
            showSubgroupDialog.value ||
            showRecentSqlDialog.value ||
            showTableActionDialog.value ||
            showSqlExportWizard.value ||
            showRenameViewModelDialog.value ||
            showDeleteViewModelDialog.value ||
            showMigrateViewModelDialog.value
        )
    }

    function runShortcutOpenSelected() {
        if (isExplorerDialogOpen()) return
        const node = explorer.selectedNode
        if (!node) return
        if (node.type === 'connection' && node.dbType) {
            workspace.openConnectionForm(node.dbType, {
                connectionId: node.id,
                connectionName: node.label,
            })
            return
        }
        void onOpen(node)
    }

    function runShortcutEditSelected() {
        if (isExplorerDialogOpen()) return
        const node = explorer.selectedNode
        if (!node) return
        if (node.type === 'table') {
            explorer.selectNode(node.id)
            openTableFromNode(node, 'properties')
            return
        }
        if (node.type === 'connection' && node.dbType) {
            workspace.openConnectionForm(node.dbType, {
                connectionId: node.id,
                connectionName: node.label,
            })
        }
    }

    function runShortcutDeleteSelected() {
        if (isExplorerDialogOpen()) return
        const node = explorer.selectedNode
        if (!node) return

        if (node.type === 'table') {
            pendingTableAction.value = {
                type: 'delete',
                node,
                message: t('explorer.deleteTableMessage', {name: node.label}),
            }
            showTableActionDialog.value = true
            return
        }

        if (node.type === 'sql_file') {
            pendingSqlFileNode.value = node
            deleteSqlMessage.value = t('explorer.deleteSqlFileMessage', {name: node.label})
            showDeleteSqlDialog.value = true
            return
        }

        if (node.type === 'connection' || node.type === 'group') {
            const label = node.label
            void explorer.deleteNode(node.id)
                .then(() => {
                    if (node.type === 'group') {
                        layout.showToast(t('explorer.groupDeleted', {name: label}))
                    }
                })
                .catch(() => {
                    layout.showToast(t('explorer.deleteFailed'))
                })
        }
    }

    function runDatabaseShortcutAction(action: ExplorerDatabaseShortcutAction) {
        if (isExplorerDialogOpen()) return
        const node = explorer.selectedNode
        if (!node || node.type !== 'database') return

        if (action === 'open') {
            const connectionId = findConnectionId(node)
            if (connectionId) {
                void openLatestSqlEditor(explorer.tree, node, findConnectionLabel(connectionId))
                    .catch(() => layout.showToast(t('console.loadSqlFileFailed')))
            }
            return
        }

        if (action === 'recent') {
            const connectionId = findConnectionId(node)
            if (connectionId) {
                void buildDatabaseConsoleContext(explorer.tree, node, findConnectionLabel(connectionId))
                    .then((ctx) => {
                        if (!ctx) return
                        recentSqlContext.value = ctx
                        showRecentSqlDialog.value = true
                    })
            }
            return
        }

        if (action === 'new') {
            const connectionId = findConnectionId(node)
            if (connectionId) {
                void createNewSqlEditor(explorer.tree, node, findConnectionLabel(connectionId))
                    .then(() => explorer.reloadWorkspacesFolder(connectionId, node.label))
                    .catch(() => layout.showToast(t('console.loadSqlFileFailed')))
            }
            return
        }

        if (action === 'console') {
            const connectionId = findConnectionId(node)
            if (connectionId) {
                void openBlankSqlConsole(explorer.tree, node, findConnectionLabel(connectionId))
                    .catch(() => layout.showToast(t('console.loadSqlFileFailed')))
            }
        }
    }

    onMounted(() => {
        void catalogStore.ensureLoaded().catch(() => undefined)
        registerExplorerNodeShortcutHandlers({
            openSelected: runShortcutOpenSelected,
            editSelected: runShortcutEditSelected,
            deleteSelected: runShortcutDeleteSelected,
        })
        registerExplorerDatabaseShortcutHandler(runDatabaseShortcutAction)
    })

    onUnmounted(() => {
        clearExplorerNodeShortcutHandlers()
        registerExplorerDatabaseShortcutHandler(null)
    })

    return {
        explorer,
        flatNodes,
        menuVisible,
        menuPos,
        menuItems,
        showRenameDialog,
        showRenameSqlDialog,
        showDeleteSqlDialog,
        showSubgroupDialog,
        renameDefaultName,
        renameSqlDefaultName,
        deleteSqlMessage,
        subgroupDefaultName,
        showRecentSqlDialog,
        recentSqlContext,
        showTableActionDialog,
        pendingTableAction,
        showSqlExportWizard,
        sqlExportWizardContext,
        sqlExportWizardExporting,
        sqlExportWizardMaxRowsDefault,
        confirmSqlExportWizardExport,
        onSelect,
        onOpen,
        onContextMenu,
        closeMenu,
        onMenuSelect,
        confirmRenameGroup,
        confirmRenameSqlFile,
        confirmDeleteSqlFile,
        confirmCreateSubgroup,
        performMoveConnection,
        confirmTableAction,
        showRenameViewModelDialog,
        renameViewModelDefaultName,
        showDeleteViewModelDialog,
        deleteViewModelMessage,
        showMigrateViewModelDialog,
        migrateViewModelTargetTable,
        confirmRenameViewModel,
        confirmDeleteViewModel,
        confirmMigrateViewModel,
    }
}
