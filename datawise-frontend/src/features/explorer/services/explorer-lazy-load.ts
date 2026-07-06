import type {DbType, TreeNode} from '@/core/types'
import {findAncestorByType} from '@/core/utils/tree'
import {ApiError} from '@/shared/api/http/request'
import {isCatalogSchemaDbType} from '@/shared/db-type-families'
import {applyPinnedSortToNodeChildren} from '@/features/explorer/services/explorer-pinned-sort.service'

export {isCatalogSchemaDbType} from '@/shared/db-type-families'

/** 后端 schema 缓存与前端树节点 id 不一致时返回 */
export function isExplorerNodeNotFoundError(error: unknown): boolean {
    const message =
        error instanceof ApiError || error instanceof Error
            ? error.message
            : String(error ?? '')
    return message.includes('EXPLORER_NODE_NOT_FOUND')
}

/** 刷新连接目录时保留仍存在的连接健康状态 */
export function pruneConnectionHealthByIds(
    health: Record<string, 'ok' | 'error'>,
    validIds: readonly string[],
): Record<string, 'ok' | 'error'> {
    const valid = new Set(validIds)
    const next: Record<string, 'ok' | 'error'> = {}
    for (const [id, status] of Object.entries(health)) {
        if (valid.has(id)) next[id] = status
    }
    return next
}

/** 子节点已缓存时，用户展开连接仍应显示绿勾 */
export function shouldAffirmConnectionHealthForCachedChildren(
    node: Pick<TreeNode, 'type' | 'children'>,
    connectionId: string,
    nodeId: string,
    notify: boolean,
): boolean {
    return (
        node.type === 'connection'
        && nodeId === connectionId
        && notify
        && Boolean(node.children?.length)
    )
}

/** Kafka / Redis 不在 Explorer 树中展示 Topic 或 Key，仅保留连接节点。 */
export function isFlatConnectionCatalog(dbType?: DbType): boolean {
    return dbType === 'kafka' || dbType === 'redis'
}

/** 过滤不应出现在连接树中的缓存子节点（历史 Topic / Key 等）。 */
export function filterConnectionSchemaChildren(dbType: DbType | undefined, children: TreeNode[]): TreeNode[] {
    if (isFlatConnectionCatalog(dbType)) {
        return []
    }
    return children
}

export function resolveConnectionDbType(tree: TreeNode[], nodeId: string): DbType | undefined {
    return findAncestorByType(tree, nodeId, 'connection')?.dbType
}

export const TABLES_FOLDER_LOADED_META = 'tables:loaded'

const LAZY_LOAD_FOLDER_LABELS = new Set(['tables', 'workspaces', 'models', 'views', 'ai', 'semantics'])

const loadedExplorerFolderIds = new Set<string>()

export function folderLoadedMeta(label: string): string {
    return `${label.trim().toLowerCase()}:loaded`
}

export function isLazyLoadFolder(node: Pick<TreeNode, 'type' | 'label'>): boolean {
    return node.type === 'folder' && LAZY_LOAD_FOLDER_LABELS.has(node.label.toLowerCase())
}

export function isExplorerFolderLoaded(node: Pick<TreeNode, 'id' | 'meta'>): boolean {
    if (node.meta?.endsWith(':loaded')) {
        return true
    }
    return loadedExplorerFolderIds.has(node.id)
}

export function isTablesFolderLoaded(node: Pick<TreeNode, 'id' | 'meta'>): boolean {
    if (node.meta === TABLES_FOLDER_LOADED_META) {
        return true
    }
    return isExplorerFolderLoaded(node)
}

export function markExplorerFolderLoaded(node: TreeNode): void {
    loadedExplorerFolderIds.add(node.id)
    if (isLazyLoadFolder(node)) {
        node.meta = folderLoadedMeta(node.label)
    }
}

export function markExplorerFolderLoadedIfNeeded(node: TreeNode): void {
    if (isLazyLoadFolder(node)) {
        markExplorerFolderLoaded(node)
    }
}

/** @deprecated Use markExplorerFolderLoadedIfNeeded */
export function markTablesFolderLoaded(node: TreeNode): void {
    markExplorerFolderLoaded(node)
}

export function clearExplorerFolderLoadedIds(predicate?: (nodeId: string) => boolean): void {
    if (!predicate) {
        loadedExplorerFolderIds.clear()
        return
    }
    for (const nodeId of [...loadedExplorerFolderIds]) {
        if (predicate(nodeId)) {
            loadedExplorerFolderIds.delete(nodeId)
        }
    }
}

function stripFolderLoadedMeta(node: TreeNode): void {
    if (node.meta?.endsWith(':loaded')) {
        delete node.meta
    }
}

/** 后端 schema 缓存可能带回 `:loaded` meta，合并前剥离以免误判已加载 */
export function stripFolderLoadedMetaFromNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.map((node) => {
        const next: TreeNode = {...node}
        if (next.type === 'folder') {
            stripFolderLoadedMeta(next)
        }
        if (next.children?.length) {
            next.children = stripFolderLoadedMetaFromNodes(next.children)
        }
        return next
    })
}

/** 构建 loadChildren 去重 key（connection + node + 分页/刷新） */
export function buildExplorerLoadChildKey(
    connectionId: string,
    nodeId: string,
    options?: {refresh?: boolean; offset?: number},
): string {
    const offset = options?.offset ?? 0
    const refresh = options?.refresh ? '1' : '0'
    return `${connectionId}:${nodeId}:${offset}:${refresh}`
}

/** catalog 下应是 schema 节点，而非历史缓存里的 tables 文件夹 */
function catalogNeedsSchemaLoad(node: TreeNode, connectionDbType?: DbType): boolean {
    const children = node.children ?? []
    if (children.length === 0) return true
    if (children.some((child) => child.type === 'schema')) return false
    // Hive 扁平库：database 节点直接挂 tables/models/views 等 folder，不会再出现 schema 子级。
    if (connectionDbType === 'hive' && children.some((child) => child.type === 'folder')) {
        return false
    }
    return true
}

/** 判断连接树节点是否尚未加载子节点，需要请求后端 */
export function needsLazyLoad(node: TreeNode, connectionDbType?: DbType): boolean {
    if (node.type === 'connection' && isFlatConnectionCatalog(node.dbType)) {
        return false
    }
    const catalogSchema = isCatalogSchemaDbType(connectionDbType ?? node.dbType)
    switch (node.type) {
        case 'connection':
        case 'table':
            return !node.children?.length
        case 'database':
            if (catalogSchema) {
                return catalogNeedsSchemaLoad(node, connectionDbType)
            }
            return !node.children?.length
        case 'schema':
            return !node.children?.length
        case 'folder':
            if (isLazyLoadFolder(node)) {
                if (isExplorerFolderLoaded(node)) {
                    return false
                }
                return !node.children?.length
            }
            return false
        case 'columns':
        case 'keys':
        case 'indexes':
            return !node.children?.length
        default:
            return false
    }
}

function areSameChildSnapshots(current: TreeNode[], loaded: TreeNode[]): boolean {
    if (current.length !== loaded.length) return false
    for (let index = 0; index < current.length; index += 1) {
        const left = current[index]
        const right = loaded[index]
        if (left.id !== right.id || left.label !== right.label || left.type !== right.type) {
            return false
        }
    }
    return true
}

/** 将 API 返回的子节点合并到当前节点；结构未变时不替换引用，避免树闪烁 */
export function mergeLoadedChildren(node: TreeNode, loaded: TreeNode[]) {
    const sanitized = stripFolderLoadedMetaFromNodes(loaded)
    const next =
        node.type === 'connection'
            ? filterConnectionSchemaChildren(node.dbType, sanitized)
            : sanitized
    const current = node.children ?? []
    if (areSameChildSnapshots(current, next)) {
        if (node.children === undefined) {
            node.children = next
            applyPinnedSortToNodeChildren(node)
        }
        return
    }
    node.children = next
    applyPinnedSortToNodeChildren(node)
}

/** 表文件夹分页：追加新页并更新 load_more 节点 */
export function appendTablePageChildren(node: TreeNode, loaded: TreeNode[]) {
    const tables = loaded.filter((child) => child.type !== 'load_more')
    const loadMore = loaded.find((child) => child.type === 'load_more')
    const existing = (node.children ?? []).filter((child) => child.type !== 'load_more')
    node.children = loadMore ? [...existing, ...tables, loadMore] : [...existing, ...tables]
    applyPinnedSortToNodeChildren(node)
}

export function resolveTablesFolderIdFromLoadMore(loadMoreNode: TreeNode): string | null {
    if (loadMoreNode.type !== 'load_more') {
        return null
    }
    const suffix = ':load-more'
    return loadMoreNode.id.endsWith(suffix)
        ? loadMoreNode.id.slice(0, -suffix.length)
        : null
}

export function parseLoadMoreOffset(loadMoreNode: TreeNode): number {
    const raw = loadMoreNode.meta?.trim()
    if (!raw) {
        return 0
    }
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}
