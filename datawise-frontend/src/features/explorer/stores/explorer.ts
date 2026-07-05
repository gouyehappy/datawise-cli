import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import type {ConnectionConfig, TreeNode, WorkspaceTab} from '@/core/types'
import {findNodeById, findParentNode, resolveConnectionId, walkTree, buildTreeNodeIndex} from '@/core/utils/tree'
import {logPerf, perfNow} from '@/core/utils/perf-log'
import {scrollExplorerNodeIntoView} from '@/core/shortcuts/action-registry'
import {resolveConsoleInstanceLabel, buildExplorerScopedLabelResolver} from '@/features/workspace/services/resolve-console-instance'
import {
    findExplorerScopeNode,
    findExplorerTablesFolder,
} from '@/features/explorer/services/explorer-database-scope'
import {
    markExpandedPath,
    shouldCollapseOnToggle,
} from '@/features/explorer/services/explorer-tree-expansion'
import {
    appendTablePageChildren,
    buildExplorerLoadChildKey,
    clearExplorerFolderLoadedIds,
    markExplorerFolderLoadedIfNeeded,
    mergeLoadedChildren,
    needsLazyLoad,
    parseLoadMoreOffset,
    resolveConnectionDbType,
    resolveTablesFolderIdFromLoadMore,
    isCatalogSchemaDbType,
    isExplorerNodeNotFoundError,
    pruneConnectionHealthByIds,
    shouldAffirmConnectionHealthForCachedChildren,
} from '@/features/explorer/services/explorer-lazy-load'
import {ensureFlatConnectionFeatureChildren} from '@/features/explorer/services/flat-connection-feature-tree.service'
import {
    resolveActiveTabLocateNodeId as resolveLocateNodeId,
    resolveLocateFolderForNode,
    countTreeNodesWithId,
} from '@/features/explorer/services/explorer-locate.service'
import {resolveSqlFileForLocate} from '@/features/workspace/services/console-tab-title'
import {explorerApi} from '@/api'
import {applyExplorerTreeStructure} from '@/shared/config/connections-explorer-tree'
import {resolveConnectionErrorMessage} from '@/features/explorer/services/connection-error-message'
import {
    readPinnedExplorerNodeIds,
    togglePinnedExplorerNodeId,
} from '@/features/explorer/services/pinned-explorer-nodes.service'
import {applyPinnedSortToNodeChildren, applyPinnedSortInTree} from '@/features/explorer/services/explorer-pinned-sort.service'
import {
    backfillPinnedTableMetadata,
    isPinnedTableFavorite,
    readPinnedTableFavorites,
    removePinnedTableFavorite,
    upsertPinnedTableFavorite,
} from '@/features/explorer/services/pinned-table-favorites.service'
import {resolveTableContext} from '@/features/explorer/services/table-context-actions.service'
import {
    readFavoritesGroupExpanded,
    writeFavoritesGroupExpanded,
} from '@/features/explorer/services/explorer-favorites-ui.service'
import {isExplorerFavoritesGroupId} from '@/features/explorer/services/explorer-favorites.constants'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useDebouncedRef} from '@/core/utils/debounced-ref'
import {
    EXPLORER_HEALTH_PROBE_CONCURRENCY,
    runWithConcurrencyLimit,
} from '@/core/utils/concurrency-limit'

function resolveExplorerLoadPerfOperation(
    connectionId: string,
    nodeId: string,
    node: TreeNode | null | undefined,
): string {
    if (connectionId === nodeId) return 'connection.expand'
    if (node?.type === 'folder') {
        if (node.label === 'tables') return 'explorer.loadTables'
        if (node.label === 'workspaces') return 'explorer.loadWorkspaces'
        if (node.label === 'models') return 'explorer.loadModels'
        if (node.label === 'views') return 'explorer.loadViews'
    }
    return 'explorer.loadChildren'
}

/** Explorer 全局状态（Pinia Store） */
export const useExplorerStore = defineStore('explorer', () => {
    const tree = ref<TreeNode[]>([])
    const treeReady = ref(false)
    const searchQuery = ref('')
    const debouncedSearchQuery = useDebouncedRef(searchQuery, 200)
    const selectedNodeId = ref<string | null>(null)
    const width = ref(248)
    const showColumnComment = ref(true)
    const showTableComment = ref(true)
    const isRefreshing = ref(false)
    const flashNodeId = ref<string | null>(null)
    const loadingNodeIds = ref<Set<string>>(new Set())
    const connectionHealthById = ref<Record<string, 'ok' | 'error'>>({})
    /** 用户已点击/展开过的连接，仅这些连接参与健康检查 */
    const attemptedConnectionIds = ref<Set<string>>(new Set())
    const connectionHealthChecking = ref(false)
    const connectionHealthCheckedAt = ref<number | null>(null)
    const loadChildPromises = new Map<string, Promise<boolean>>()
    const childEtags = new Map<string, string>()
    const nodeIndex = ref<Map<string, TreeNode>>(new Map())
    const pinnedNodeIds = ref<Set<string>>(new Set(readPinnedExplorerNodeIds()))
    const favoritesGroupExpanded = ref(readFavoritesGroupExpanded())
    const favoritesShowAll = ref(false)

    let flashTimer: ReturnType<typeof setTimeout> | null = null

    const allCommentsVisible = computed(
        () => showColumnComment.value && showTableComment.value,
    )

    const selectedNode = computed((): TreeNode | null => {
        if (!selectedNodeId.value) return null
        return findNode(selectedNodeId.value)
    })

    const connectionCount = computed(() => {
        let count = 0
        walkTree(tree.value, (node) => {
            if (node.type === 'connection') count++
        })
        return count
    })

    function rebuildNodeIndex() {
        nodeIndex.value = buildTreeNodeIndex(tree.value)
    }

    function findNode(nodeId: string): TreeNode | null {
        return nodeIndex.value.get(nodeId) ?? findNodeById(tree.value, nodeId)
    }

    function setConnectionHealth(connectionId: string, health: 'ok' | 'error' | null) {
        if (!health) {
            if (!(connectionId in connectionHealthById.value)) return
            const next = {...connectionHealthById.value}
            delete next[connectionId]
            connectionHealthById.value = next
            return
        }
        connectionHealthById.value = {...connectionHealthById.value, [connectionId]: health}
    }

    function markConnectionAttempted(connectionId: string) {
        if (attemptedConnectionIds.value.has(connectionId)) return
        attemptedConnectionIds.value = new Set([...attemptedConnectionIds.value, connectionId])
    }

    function hasAttemptedConnections() {
        return attemptedConnectionIds.value.size > 0
    }

    function pruneAttemptedConnections(validIds: readonly string[]) {
        const valid = new Set(validIds)
        attemptedConnectionIds.value = new Set(
            [...attemptedConnectionIds.value].filter((id) => valid.has(id)),
        )
    }

    function reportConnectionFailure(connectionId: string, error: unknown, options?: {notify?: boolean}) {
        if (options?.notify !== true) return
        useLayoutStore().showToast(resolveConnectionErrorMessage(error))
    }

    function collectConnectionIdsFromTree(): string[] {
        const ids: string[] = []
        walkTree(tree.value, (node) => {
            if (node.type === 'connection') ids.push(node.id)
        })
        return ids
    }

    async function probeAllConnectionHealth() {
        if (connectionHealthChecking.value) return
        const ids = collectConnectionIdsFromTree().filter((id) => attemptedConnectionIds.value.has(id))
        connectionHealthChecking.value = true
        try {
            if (!ids.length) {
                return
            }
            await runWithConcurrencyLimit(ids, EXPLORER_HEALTH_PROBE_CONCURRENCY, async (connectionId) => {
                try {
                    const result = await explorerApi.pingConnection(connectionId)
                    setConnectionHealth(connectionId, result.ok ? 'ok' : 'error')
                } catch {
                    setConnectionHealth(connectionId, 'error')
                }
            })
            connectionHealthCheckedAt.value = Date.now()
        } finally {
            connectionHealthChecking.value = false
        }
    }

    async function loadNodeChildren(
        connectionId: string,
        nodeId: string,
        options?: {notify?: boolean; refresh?: boolean; offset?: number; append?: boolean},
    ): Promise<boolean> {
        const requestKey = buildExplorerLoadChildKey(connectionId, nodeId, options)
        const inFlight = loadChildPromises.get(requestKey)
        if (inFlight) return inFlight

        const task = (async (): Promise<boolean> => {
        const silent = {silent: true}
        const notify = options?.notify === true
        const node = findNode(nodeId)
        const startedAt = perfNow()
        const etagKey = `${connectionId}:${nodeId}`
        try {
            const result = await explorerApi.loadChildren(connectionId, nodeId, {
                ...silent,
                refresh: options?.refresh,
                offset: options?.offset,
                ifNoneMatch:
                    options?.refresh || options?.offset != null
                        ? undefined
                        : childEtags.get(etagKey),
            })
            if (result.etag) {
                childEtags.set(etagKey, result.etag)
            }
            const latest = findNode(nodeId)
            if (result.unchanged) {
                if (result.etag) {
                    childEtags.set(etagKey, result.etag)
                }
                if (latest) markExplorerFolderLoadedIfNeeded(latest)
                return true
            }
            if (latest) {
                if (options?.append) {
                    appendTablePageChildren(latest, result.tree)
                } else {
                    mergeLoadedChildren(latest, result.tree)
                }
                markExplorerFolderLoadedIfNeeded(latest)
                rebuildNodeIndex()
            }
            logPerf(resolveExplorerLoadPerfOperation(connectionId, nodeId, latest), startedAt, {
                connectionId,
                nodeId,
                childCount: result.tree.length,
            })
            return true
        } catch (error) {
            if (nodeId === connectionId) {
                reportConnectionFailure(connectionId, error, {notify})
                return false
            }
            if (!isExplorerNodeNotFoundError(error)) {
                return false
            }
            // 后端 schema 缓存与前端节点 id 不同步：先重载连接层再重试一次
            try {
                childEtags.delete(etagKey)
                const databases = await explorerApi.loadChildren(connectionId, connectionId, {
                    ...silent,
                    refresh: true,
                })
                const connection = findNode(connectionId)
                if (connection) mergeLoadedChildren(connection, databases.tree)
                const children = await explorerApi.loadChildren(connectionId, nodeId, silent)
                const latest = findNode(nodeId)
                if (latest) {
                    mergeLoadedChildren(latest, children.tree)
                    markExplorerFolderLoadedIfNeeded(latest)
                }
                rebuildNodeIndex()
                if (children.etag) {
                    childEtags.set(etagKey, children.etag)
                }
                return true
            } catch (retryError) {
                reportConnectionFailure(connectionId, retryError, {notify})
                return false
            }
        }
        })()

        loadChildPromises.set(requestKey, task)
        try {
            return await task
        } finally {
            loadChildPromises.delete(requestKey)
        }
    }

    async function loadMoreTables(loadMoreNode: TreeNode) {
        const folderId = resolveTablesFolderIdFromLoadMore(loadMoreNode)
        if (!folderId) return
        const connectionId = resolveConnectionId(tree.value, folderId)
        if (!connectionId) return
        if (loadingNodeIds.value.has(loadMoreNode.id)) return
        const offset = parseLoadMoreOffset(loadMoreNode)
        loadingNodeIds.value.add(loadMoreNode.id)
        try {
            await loadNodeChildren(connectionId, folderId, {offset, append: true})
        } finally {
            loadingNodeIds.value.delete(loadMoreNode.id)
        }
    }

    async function ensureChildrenLoaded(nodeId: string, options?: {notify?: boolean}): Promise<void> {
        const node = findNode(nodeId)
        if (!node) return

        const connectionId = resolveConnectionId(tree.value, nodeId)
        if (!connectionId) return

        const isConnectionProbe = node.type === 'connection' && nodeId === connectionId
        const notify = options?.notify === true

        if (!needsLazyLoad(node, resolveConnectionDbType(tree.value, nodeId))) {
            if (shouldAffirmConnectionHealthForCachedChildren(node, connectionId, nodeId, notify)) {
                markConnectionAttempted(connectionId)
                setConnectionHealth(connectionId, 'ok')
            }
            return
        }

        const inFlight = loadChildPromises.get(buildExplorerLoadChildKey(connectionId, nodeId))
        if (inFlight) {
            await inFlight
            return
        }

        loadingNodeIds.value.add(nodeId)
        try {
            if (isConnectionProbe && notify) {
                markConnectionAttempted(connectionId)
            }
            const ok = await loadNodeChildren(connectionId, nodeId, {notify})
            if (isConnectionProbe && notify) {
                setConnectionHealth(connectionId, ok ? 'ok' : 'error')
            }
        } finally {
            loadingNodeIds.value.delete(nodeId)
        }
    }

    /** 加载子级并展开（expanded 仅表示 UI 状态，不表示已加载） */
    async function expandAndLoad(nodeId: string, options?: {load?: boolean; notify?: boolean}) {
        const node = findNode(nodeId)
        if (!node) return
        ensureFlatConnectionFeatureChildren(node)
        if (options?.load !== false) {
            await ensureChildrenLoaded(nodeId, {notify: options?.notify})
        }
        node.expanded = true
    }

    /** 从根到目标：逐层 load + expand，避免 expandToNode 只改 UI 标志导致空节点 */
    async function expandPathToNode(nodeId: string, options?: {notify?: boolean}) {
        const chain: TreeNode[] = []
        walkTree(tree.value, (node, parents) => {
            if (node.id === nodeId) {
                chain.push(...parents, node)
                return true
            }
        })
        const segments: TreeNode[][] = []
        let currentSegment: TreeNode[] = []
        let currentConnectionId: string | null = null
        for (const item of chain) {
            const connectionId = resolveConnectionId(tree.value, item.id) ?? ''
            if (currentConnectionId !== null && connectionId !== currentConnectionId) {
                segments.push(currentSegment)
                currentSegment = []
            }
            currentConnectionId = connectionId
            currentSegment.push(item)
        }
        if (currentSegment.length) {
            segments.push(currentSegment)
        }
        await Promise.all(
            segments.map(async (segment) => {
                const pendingLoads: Array<{nodeId: string; notify: boolean}> = []
                for (const item of segment) {
                    const node = findNode(item.id)
                    if (!node) continue
                    ensureFlatConnectionFeatureChildren(node)
                    const connectionId = resolveConnectionId(tree.value, item.id) ?? ''
                    const notify = options?.notify === true && item.type === 'connection'
                    const dbType = resolveConnectionDbType(tree.value, item.id)
                    if (needsLazyLoad(node, dbType)) {
                        pendingLoads.push({nodeId: item.id, notify})
                        continue
                    }
                    if (
                        shouldAffirmConnectionHealthForCachedChildren(
                            node,
                            connectionId,
                            item.id,
                            notify,
                        )
                    ) {
                        markConnectionAttempted(connectionId)
                        setConnectionHealth(connectionId, 'ok')
                    }
                    node.expanded = true
                }
                for (const load of pendingLoads) {
                    await ensureChildrenLoaded(load.nodeId, {notify: load.notify})
                    const loaded = findNode(load.nodeId)
                    if (loaded) loaded.expanded = true
                }
            }),
        )
    }

    function collapseNode(nodeId: string) {
        const node = findNode(nodeId)
        if (node) node.expanded = false
    }

    async function toggleExpand(nodeId: string, options?: {notify?: boolean}) {
        if (isExplorerFavoritesGroupId(nodeId)) {
            toggleFavoritesGroupExpanded()
            return
        }
        const node = findNode(nodeId)
        if (!node) return

        if (node.type === 'load_more') {
            await loadMoreTables(node)
            return
        }

        const dbType = resolveConnectionDbType(tree.value, nodeId)
        if (shouldCollapseOnToggle(node, dbType)) {
            collapseNode(nodeId)
            return
        }
        const notify = options?.notify ?? node.type === 'connection'
        await expandAndLoad(nodeId, {notify})
    }

    function selectNode(nodeId: string) {
        selectedNodeId.value = nodeId
    }

    /** @deprecated 仅用于 group 等无懒加载节点；连接/schema 请用 expandPathToNode */
    function expandToNode(nodeId: string) {
        markExpandedPath(tree.value, nodeId)
    }

    function locatePathNeedsFetch(activeTab: WorkspaceTab): boolean {
        if (!activeTab.connectionId) return false

        const conn = findNode(activeTab.connectionId)
        if (conn && needsLazyLoad(conn, conn.dbType)) return true

        if (activeTab.type !== 'console' && activeTab.type !== 'table') return false

        const databaseLabel =
            activeTab.type === 'table'
                ? activeTab.database?.trim()
                ?? (activeTab.instanceId
                    ? findNode(activeTab.instanceId)?.label?.trim()
                    : undefined)
                : resolveConsoleInstanceLabel({
                    tabInstanceId: activeTab.instanceId,
                    tabDatabase: activeTab.database,
                    findNodeLabel: (nodeId) => findNode(nodeId)?.label,
                    resolveScopedLabel: buildExplorerScopedLabelResolver(tree.value, findNode),
                })

        if (!databaseLabel) return false

        const databaseNode = findDatabaseNode(
            activeTab.connectionId,
            databaseLabel,
            activeTab.instanceId,
        )
        if (!databaseNode) return true
        const connectionDbType = resolveConnectionDbType(tree.value, activeTab.connectionId)
        if (needsLazyLoad(databaseNode, connectionDbType)) return true

        const needsFolder =
            activeTab.type === 'table'
                ? !!activeTab.tableName?.trim()
                : !!resolveSqlFileForLocate(activeTab)
        if (!needsFolder) return false

        const folderLabel = activeTab.type === 'table' ? 'tables' : 'workspaces'
        const folder =
            folderLabel === 'tables'
                ? findExplorerTablesFolder(databaseNode)
                : databaseNode.children?.find(
                    (child) => child.type === 'folder' && child.label.toLowerCase() === folderLabel,
                )
        if (!folder) return true
        return needsLazyLoad(folder, connectionDbType)
    }

    function findTableNodeId(tableName: string): string | null {
        let found: string | null = null
        walkTree(tree.value, (node) => {
            if (node.type === 'table' && node.label === tableName) {
                found = node.id
                return true
            }
        })
        return found
    }

    function resolveActiveTabLocateNodeId(activeTab: WorkspaceTab | null): string | null {
        return resolveLocateNodeId(activeTab, {
            findNode,
            findDatabaseNode,
            findNodeLabel: (nodeId) => findNode(nodeId)?.label,
            findTableNodeGlobal: findTableNodeId,
        })
    }

    async function ensureDatabaseBranchLoaded(
        connectionId: string,
        instanceLabel: string,
        instanceId?: string | null,
    ): Promise<TreeNode | null> {
        await ensureChildrenLoaded(connectionId)
        const databaseNode = findDatabaseNode(connectionId, instanceLabel, instanceId)
        if (!databaseNode) return null
        await ensureChildrenLoaded(databaseNode.id)
        if (!databaseNode.expanded) databaseNode.expanded = true
        return findDatabaseNode(connectionId, instanceLabel, instanceId)
    }

    async function ensureFolderBranchLoaded(
        connectionId: string,
        databaseNode: TreeNode,
        folderLabel: 'tables' | 'workspaces',
    ) {
        const folder = databaseNode.children?.find(
            (child) => child.type === 'folder' && child.label.toLowerCase() === folderLabel,
        )
        if (!folder) return
        await ensureChildrenLoaded(folder.id)
        if (!folder.expanded) folder.expanded = true
    }

    async function ensureLocatePathLoaded(activeTab: WorkspaceTab): Promise<void> {
        if (!activeTab.connectionId) return

        const pinnedId = activeTab.explorerNodeId?.trim()
        const pinnedNode = pinnedId ? findNode(pinnedId) : null
        const folderLabel = pinnedNode ? resolveLocateFolderForNode(pinnedNode) : null

        if (activeTab.type === 'console') {
            const instanceLabel = resolveConsoleInstanceLabel({
                tabInstanceId: activeTab.instanceId,
                tabDatabase: activeTab.database,
                findNodeLabel: (nodeId) => findNode(nodeId)?.label,
                resolveScopedLabel: buildExplorerScopedLabelResolver(tree.value, findNode),
            })
            if (!instanceLabel) {
                await ensureChildrenLoaded(activeTab.connectionId)
                return
            }
            const databaseNode = await ensureDatabaseBranchLoaded(
                activeTab.connectionId,
                instanceLabel,
                activeTab.instanceId,
            )
            if (!databaseNode) return
            const needsWorkspaces =
                folderLabel === 'workspaces'
                || !!resolveSqlFileForLocate(activeTab)
            if (needsWorkspaces) {
                await ensureFolderBranchLoaded(activeTab.connectionId, databaseNode, 'workspaces')
            }
            return
        }

        if (activeTab.type === 'table' && activeTab.tableName?.trim()) {
            const databaseLabel =
                activeTab.database?.trim()
                ?? (activeTab.instanceId
                    ? findNode(activeTab.instanceId)?.label?.trim()
                    : undefined)
            if (!databaseLabel) {
                await ensureChildrenLoaded(activeTab.connectionId)
                return
            }
            const databaseNode = await ensureDatabaseBranchLoaded(
                activeTab.connectionId,
                databaseLabel,
                activeTab.instanceId,
            )
            if (!databaseNode) return
            if (folderLabel === 'tables' || activeTab.tableName.trim()) {
                await ensureFolderBranchLoaded(activeTab.connectionId, databaseNode, 'tables')
            }
            return
        }

        await ensureChildrenLoaded(activeTab.connectionId)
    }

    async function resolveActiveTabLocateNodeIdAsync(
        activeTab: WorkspaceTab | null,
    ): Promise<string | null> {
        if (!activeTab) return null

        const cachedTargetId = resolveActiveTabLocateNodeId(activeTab)
        if (cachedTargetId && findNode(cachedTargetId) && !locatePathNeedsFetch(activeTab)) {
            return cachedTargetId
        }

        if (activeTab.connectionId && (activeTab.type === 'console' || activeTab.type === 'table')) {
            await ensureLocatePathLoaded(activeTab)
        } else if (activeTab.connectionId) {
            await ensureChildrenLoaded(activeTab.connectionId)
        }
        return resolveActiveTabLocateNodeId(activeTab)
    }

    async function revealNode(nodeId: string, options?: { select?: boolean }): Promise<TreeNode | null> {
        const node = findNode(nodeId)
        if (!node) return null
        const wasSelected = selectedNodeId.value === nodeId
        if (searchQuery.value.trim()) searchQuery.value = ''
        await expandPathToNode(nodeId)
        if (options?.select !== false) selectNode(nodeId)
        if (!wasSelected) triggerFlash(nodeId)
        scrollExplorerNodeIntoView(nodeId)
        return node
    }

    async function locateActiveTabNode(activeTab: WorkspaceTab | null): Promise<TreeNode | null> {
        let nodeId = await resolveActiveTabLocateNodeIdAsync(activeTab)
        if (!nodeId) return null

        if (
            activeTab?.type === 'console'
            && activeTab.connectionId
            && resolveSqlFileForLocate(activeTab)
            && countTreeNodesWithId(tree.value, nodeId) > 1
        ) {
            const instanceLabel = resolveConsoleInstanceLabel({
                tabInstanceId: activeTab.instanceId,
                tabDatabase: activeTab.database,
                findNodeLabel: (id) => findNode(id)?.label,
                resolveScopedLabel: buildExplorerScopedLabelResolver(tree.value, findNode),
            })
            if (instanceLabel) {
                await reloadWorkspacesFolder(activeTab.connectionId, instanceLabel, activeTab.instanceId)
                nodeId = await resolveActiveTabLocateNodeIdAsync(activeTab)
                if (!nodeId) return null
            }
        }

        return revealNode(nodeId, {select: true})
    }

    async function locateSelectedNode(): Promise<TreeNode | null> {
        if (!selectedNodeId.value) return null
        return revealNode(selectedNodeId.value, {select: false})
    }

    function triggerFlash(nodeId: string) {
        if (flashTimer) clearTimeout(flashTimer)
        flashNodeId.value = nodeId
        flashTimer = setTimeout(() => {
            flashNodeId.value = null
            flashTimer = null
        }, 700)
    }

    async function locateNode(nodeId: string): Promise<TreeNode | null> {
        return revealNode(nodeId, {select: true})
    }

    function clearFlash() {
        if (flashTimer) clearTimeout(flashTimer)
        flashTimer = null
        flashNodeId.value = null
    }

    function commitExplorerTree(nextRoots: TreeNode[]) {
        tree.value = applyExplorerTreeStructure(nextRoots, tree.value)
        rebuildNodeIndex()
        backfillPinnedTableMetadata(tree.value)
        applyPinnedSortInTree(tree.value)
        const validConnectionIds = collectConnectionIdsFromTree()
        connectionHealthById.value = pruneConnectionHealthByIds(
            connectionHealthById.value,
            validConnectionIds,
        )
        pruneAttemptedConnections(validConnectionIds)
    }

    async function reloadExplorerTree(refresh = false) {
        const nextRoots = await explorerApi.fetchTree(refresh ? {refresh: true} : undefined)
        commitExplorerTree(nextRoots)
    }

    async function afterExplorerMutation<T extends {tree: TreeNode[]}>(
        mutate: () => Promise<T>,
    ): Promise<T> {
        const result = await mutate()
        commitExplorerTree(result.tree)
        return result
    }

    async function afterExplorerTreeUpdate(mutate: () => Promise<TreeNode[]>): Promise<void> {
        commitExplorerTree(await mutate())
    }

    async function loadTree() {
        try {
            await reloadExplorerTree()
            const nodes = tree.value
            if (!selectedNodeId.value) {
                selectedNodeId.value = nodes[0]?.children?.[0]?.id ?? nodes[0]?.id ?? null
            }
        } finally {
            treeReady.value = true
        }
    }

    async function refreshTree() {
        if (isRefreshing.value) return
        isRefreshing.value = true
        try {
            await reloadExplorerTree(true)
        } finally {
            isRefreshing.value = false
        }
    }

    async function addRootFolder(label: string) {
        const {groupId} = await afterExplorerMutation(() => explorerApi.createGroup(label))
        clearFlash()
        await revealNode(groupId, {select: true})
        return groupId
    }

    async function addGroup(label: string, parentId: string) {
        const {groupId} = await afterExplorerMutation(() => explorerApi.createGroup(label, parentId))
        clearFlash()
        await expandPathToNode(parentId)
        await revealNode(groupId, {select: true})
        return groupId
    }

    async function renameGroup(groupId: string, label: string) {
        await afterExplorerTreeUpdate(() => explorerApi.updateGroup(groupId, label))
        selectNode(groupId)
        expandToNode(groupId)
    }

    async function addConnection(config: ConnectionConfig, groupId?: string) {
        const {connectionId} = await afterExplorerMutation(() =>
            explorerApi.createConnection(config, groupId),
        )
        selectNode(connectionId)
        expandToNode(connectionId)
        const connection = findNode(connectionId)
        if (connection && !connection.expanded) {
            await toggleExpand(connectionId)
        }
        return connectionId
    }

    async function updateConnection(connectionId: string, config: ConnectionConfig) {
        await afterExplorerTreeUpdate(() => explorerApi.updateConnection(connectionId, config))
    }

    async function moveConnection(connectionId: string, targetGroupId: string) {
        await afterExplorerTreeUpdate(() => explorerApi.moveConnection(connectionId, targetGroupId))
        selectNode(connectionId)
        expandToNode(targetGroupId)
        expandToNode(connectionId)
    }

    async function deleteNode(nodeId: string) {
        await afterExplorerTreeUpdate(() => explorerApi.deleteNode(nodeId))
        if (selectedNodeId.value === nodeId) {
            selectedNodeId.value = tree.value[0]?.id ?? null
        }
    }

    function findDatabaseNode(connectionId: string, instanceLabel: string, instanceId?: string | null): TreeNode | null {
        const connection = findNode(connectionId)
        const dbType = resolveConnectionDbType(tree.value, connectionId) ?? connection?.dbType

        if (instanceId) {
            const byId = findNode(instanceId)
            if (byId && (byId.type === 'database' || byId.type === 'schema')) {
                const parentConnectionId = resolveConnectionId(tree.value, byId.id)
                if (parentConnectionId === connectionId) {
                    return byId
                }
            }
        }

        if (connection && isCatalogSchemaDbType(dbType) && instanceLabel.includes('.')) {
            return findExplorerScopeNode(connection, dbType, instanceLabel)
        }

        let found: TreeNode | null = null
        walkTree(tree.value, (node, parents) => {
            if (node.type !== 'database' || node.label !== instanceLabel) return
            const connectionNode = [...parents].reverse().find((item) => item.type === 'connection')
            if (connectionNode?.id === connectionId) {
                found = node
                return true
            }
        })
        return found
    }

    async function forceLoadChildren(connectionId: string, node: TreeNode) {
        loadingNodeIds.value.add(node.id)
        try {
            const result = await explorerApi.loadChildren(connectionId, node.id)
            mergeLoadedChildren(node, result.tree)
            rebuildNodeIndex()
            return result.tree
        } finally {
            loadingNodeIds.value.delete(node.id)
        }
    }

    async function reloadTablesFolder(
        connectionId: string,
        databaseLabel: string,
        databaseNodeId?: string | null,
    ) {
        let databaseNode = findDatabaseNode(connectionId, databaseLabel, databaseNodeId)
        if (!databaseNode && databaseNodeId) {
            databaseNode = findDatabaseNode(connectionId, databaseLabel)
        }
        if (!databaseNode) return

        await expandPathToNode(databaseNode.id)
        await forceLoadChildren(connectionId, databaseNode)

        const folder = findExplorerTablesFolder(databaseNode)
        if (!folder) return

        folder.children = []
        await forceLoadChildren(connectionId, folder)
        folder.expanded = true
    }

    async function reloadWorkspacesFolder(
        connectionId: string,
        instanceLabel: string,
        instanceId?: string | null,
    ) {
        const connectionNode = findNode(connectionId)
        if (connectionNode && !connectionNode.children?.length) {
            await forceLoadChildren(connectionId, connectionNode)
            connectionNode.expanded = true
        }

        let scopeNode = findDatabaseNode(connectionId, instanceLabel, instanceId)
        if (!scopeNode && instanceId) {
            scopeNode = findDatabaseNode(connectionId, instanceLabel)
        }
        if (!scopeNode) return

        await expandPathToNode(scopeNode.id)
        await forceLoadChildren(connectionId, scopeNode)

        const folder = scopeNode.children?.find(
            (child) => child.type === 'folder' && child.label === 'workspaces',
        )
        if (!folder) return

        await forceLoadChildren(connectionId, folder)
        folder.expanded = true
        await expandPathToNode(folder.id)
    }

    async function reloadModelsFolder(
        connectionId: string,
        instanceLabel: string,
        instanceId?: string | null,
    ) {
        const connectionNode = findNode(connectionId)
        if (connectionNode && !connectionNode.children?.length) {
            await forceLoadChildren(connectionId, connectionNode)
            connectionNode.expanded = true
        }

        let scopeNode = findDatabaseNode(connectionId, instanceLabel, instanceId)
        if (!scopeNode && instanceId) {
            scopeNode = findDatabaseNode(connectionId, instanceLabel)
        }
        if (!scopeNode) return

        await expandPathToNode(scopeNode.id)
        await forceLoadChildren(connectionId, scopeNode)

        const folder = scopeNode.children?.find(
            (child) => child.type === 'folder' && child.label === 'models',
        )
        if (!folder) return

        folder.children = []
        await forceLoadChildren(connectionId, folder)
        folder.expanded = true
        await expandPathToNode(folder.id)
    }

    /** @deprecated use reloadModelsFolder */
    async function reloadViewsFolder(
        connectionId: string,
        instanceLabel: string,
        instanceId?: string | null,
    ) {
        return reloadModelsFolder(connectionId, instanceLabel, instanceId)
    }

    async function importConnections(configs: ConnectionConfig[]) {
        const {count} = await afterExplorerMutation(() => explorerApi.importConnections(configs))
        return count
    }

    function setAllCommentsVisible(visible: boolean) {
        showColumnComment.value = visible
        showTableComment.value = visible
    }

    function toggleAllComments() {
        setAllCommentsVisible(!allCommentsVisible.value)
    }

    function clearConnectionLoadedState(connectionId: string) {
        const node = findNode(connectionId)
        if (!node || node.type !== 'connection') return
        node.children = undefined
        node.expanded = false
        setConnectionHealth(connectionId, null)
        for (const key of [...loadChildPromises.keys()]) {
            if (key.startsWith(`${connectionId}:`)) {
                loadChildPromises.delete(key)
            }
        }
        clearExplorerFolderLoadedIds((nodeId) => nodeId.includes(connectionId))
        if (attemptedConnectionIds.value.has(connectionId)) {
            attemptedConnectionIds.value = new Set(
                [...attemptedConnectionIds.value].filter((id) => id !== connectionId),
            )
        }
    }

    async function disconnectConnection(connectionId: string): Promise<boolean> {
        const node = findNode(connectionId)
        if (!node || node.type !== 'connection') return false
        try {
            await explorerApi.disconnectConnection(connectionId)
            clearConnectionLoadedState(connectionId)
            return true
        } catch {
            return false
        }
    }

    async function connectConnection(
        connectionId: string,
        options?: {notify?: boolean},
    ): Promise<boolean> {
        const node = findNode(connectionId)
        if (!node || node.type !== 'connection') return false

        loadingNodeIds.value.add(connectionId)
        const startedAt = perfNow()
        try {
            const result = await explorerApi.connectConnection(connectionId)
            logPerf('connection.api', startedAt, {
                connectionId,
                ok: result.ok,
                serverProbeMs: result.latencyMs,
            })
            if (!result.ok) {
                markConnectionAttempted(connectionId)
                setConnectionHealth(connectionId, 'error')
                if (options?.notify === true) {
                    useLayoutStore().showToast(result.message || resolveConnectionErrorMessage(result))
                }
                return false
            }
            markConnectionAttempted(connectionId)
            const expandStartedAt = perfNow()
            await expandAndLoad(connectionId, {notify: options?.notify})
            logPerf('connection.expand', expandStartedAt, {connectionId})
            logPerf('connection.total', startedAt, {connectionId, ok: true})
            setConnectionHealth(connectionId, 'ok')
            return true
        } catch (error) {
            markConnectionAttempted(connectionId)
            setConnectionHealth(connectionId, 'error')
            reportConnectionFailure(connectionId, error, {notify: options?.notify})
            return false
        } finally {
            loadingNodeIds.value.delete(connectionId)
        }
    }

    async function reconnectConnection(
        connectionId: string,
        options?: {notify?: boolean},
    ): Promise<boolean> {
        const node = findNode(connectionId)
        if (!node || node.type !== 'connection') return false

        clearConnectionLoadedState(connectionId)
        loadingNodeIds.value.add(connectionId)
        const startedAt = perfNow()
        try {
            const result = await explorerApi.reconnectConnection(connectionId)
            logPerf('connection.reconnect.api', startedAt, {
                connectionId,
                ok: result.ok,
                serverProbeMs: result.latencyMs,
            })
            if (!result.ok) {
                markConnectionAttempted(connectionId)
                setConnectionHealth(connectionId, 'error')
                if (options?.notify === true) {
                    useLayoutStore().showToast(result.message || resolveConnectionErrorMessage(result))
                }
                return false
            }
            markConnectionAttempted(connectionId)
            const expandStartedAt = perfNow()
            await expandAndLoad(connectionId, {notify: options?.notify})
            logPerf('connection.reconnect.expand', expandStartedAt, {connectionId})
            logPerf('connection.reconnect.total', startedAt, {connectionId, ok: true})
            setConnectionHealth(connectionId, 'ok')
            return true
        } catch (error) {
            markConnectionAttempted(connectionId)
            setConnectionHealth(connectionId, 'error')
            reportConnectionFailure(connectionId, error, {notify: options?.notify})
            return false
        } finally {
            loadingNodeIds.value.delete(connectionId)
        }
    }

    async function reloadRedisKeys(connectionId: string, pattern?: string) {
        const connection = findNode(connectionId)
        if (!connection || connection.dbType !== 'redis') return
        markConnectionAttempted(connectionId)
        loadingNodeIds.value.add(connectionId)
        try {
            const result = await explorerApi.loadChildren(connectionId, connectionId, {pattern, refresh: true})
            mergeLoadedChildren(connection, result.tree)
            rebuildNodeIndex()
            connection.expanded = true
            setConnectionHealth(connectionId, 'ok')
        } finally {
            loadingNodeIds.value.delete(connectionId)
        }
    }

    function refreshPinnedNodeIds() {
        pinnedNodeIds.value = new Set(readPinnedExplorerNodeIds())
    }

    function isNodePinned(nodeId: string): boolean {
        return pinnedNodeIds.value.has(nodeId)
    }

    /** @returns 切换后是否已置顶 */
    function togglePinnedNode(nodeId: string): boolean {
        const node = findNode(nodeId)
        const wasTableFavorite = isPinnedTableFavorite(nodeId)
        const pinned = togglePinnedExplorerNodeId(nodeId)
        if (pinned && node?.type === 'table') {
            const ctx = resolveTableContext(tree.value, node)
            if (ctx) {
                const connection = findNode(ctx.connectionId)
                upsertPinnedTableFavorite({
                    nodeId: ctx.nodeId,
                    connectionId: ctx.connectionId,
                    database: ctx.database,
                    tableName: ctx.tableName,
                    connectionLabel: connection?.label,
                    dbType: ctx.dbType,
                })
            }
        } else if (!pinned && (node?.type === 'table' || wasTableFavorite)) {
            removePinnedTableFavorite(nodeId)
            if (!readPinnedTableFavorites().length) {
                favoritesShowAll.value = false
            }
        }
        refreshPinnedNodeIds()
        const parent = findParentNode(tree.value, nodeId)
        if (parent) {
            applyPinnedSortToNodeChildren(parent)
        }
        return pinned
    }

    function toggleFavoritesGroupExpanded() {
        favoritesGroupExpanded.value = !favoritesGroupExpanded.value
        writeFavoritesGroupExpanded(favoritesGroupExpanded.value)
    }

    function showAllFavoriteTables() {
        favoritesShowAll.value = true
        favoritesGroupExpanded.value = true
        writeFavoritesGroupExpanded(true)
    }

    const visibleTree = computed(() => tree.value)

    return {
        tree,
        treeReady,
        searchQuery,
        debouncedSearchQuery,
        selectedNodeId,
        selectedNode,
        width,
        showColumnComment,
        showTableComment,
        isRefreshing,
        flashNodeId,
        loadingNodeIds,
        pinnedNodeIds,
        favoritesGroupExpanded,
        favoritesShowAll,
        connectionHealthById,
        attemptedConnectionIds,
        hasAttemptedConnections,
        markConnectionAttempted,
        setConnectionHealth,
        connectionHealthChecking,
        connectionHealthCheckedAt,
        allCommentsVisible,
        setAllCommentsVisible,
        toggleAllComments,
        connectionCount,
        visibleTree,
        findNode,
        isNodePinned,
        togglePinnedNode,
        refreshPinnedNodeIds,
        toggleFavoritesGroupExpanded,
        showAllFavoriteTables,
        ensureChildrenLoaded,
        expandAndLoad,
        expandPathToNode,
        collapseNode,
        toggleExpand,
        selectNode,
        expandToNode,
        locateNode,
        locateActiveTabNode,
        locateSelectedNode,
        clearFlash,
        loadTree,
        refreshTree,
        addRootFolder,
        addGroup,
        renameGroup,
        addConnection,
        updateConnection,
        moveConnection,
        deleteNode,
        reloadWorkspacesFolder,
        reloadModelsFolder,
        reloadViewsFolder,
        reloadTablesFolder,
        importConnections,
        reloadRedisKeys,
        probeAllConnectionHealth,
        disconnectConnection,
        connectConnection,
        reconnectConnection,
    }
})
