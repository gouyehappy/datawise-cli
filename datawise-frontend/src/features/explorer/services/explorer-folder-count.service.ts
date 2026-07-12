import type {TreeNode} from '@/core/types'
import {resolveExplorerCatalogLabelKey} from '@/features/explorer/services/explorer-catalog-label.service'
import {isExplorerFolderLoaded} from '@/features/explorer/services/explorer-lazy-load'

const COUNTABLE_CHILD_TYPES = new Set([
    'table',
    'view',
    'function',
    'procedure',
    'trigger',
    'view_model',
    'column',
    'primary_key',
    'index',
    'key',
    'platform_feature',
    'redis-feature',
    'kafka-feature',
])

export function shouldShowFolderItemCount(node: TreeNode): boolean {
    if (node.type === 'folder') {
        return resolveExplorerCatalogLabelKey(node) != null
    }
    return node.type === 'columns' || node.type === 'keys' || node.type === 'indexes'
}

function countFolderChildren(node: TreeNode): number {
    return (node.children ?? []).filter((child) => {
        if (child.type === 'load_more') return false
        if (node.type === 'folder') {
            return COUNTABLE_CHILD_TYPES.has(child.type)
        }
        return true
    }).length
}

export function resolveFolderItemCount(node: TreeNode): number | null {
    if (!shouldShowFolderItemCount(node)) return null

    if (typeof node.childCount === 'number' && Number.isFinite(node.childCount)) {
        const children = node.children ?? []
        const hasLoadedChildren = children.some((child) => child.type !== 'load_more')
        if (hasLoadedChildren || isExplorerFolderLoaded(node) || node.type !== 'folder') {
            return Math.max(node.childCount, countFolderChildren(node))
        }
        return Math.max(0, Math.round(node.childCount))
    }

    const children = node.children ?? []
    const countable = countFolderChildren(node)
    if (countable > 0) return countable
    if (isExplorerFolderLoaded(node) || node.type !== 'folder') return 0
    return null
}

export function syncFolderChildCount(node: TreeNode): void {
    if (!shouldShowFolderItemCount(node)) return
    const children = node.children ?? []
    const hasLoadMore = children.some((child) => child.type === 'load_more')
    const countable = countFolderChildren(node)
    const hasLoadedChildren = children.some((child) => child.type !== 'load_more')
    if (!hasLoadedChildren && !isExplorerFolderLoaded(node) && node.type === 'folder') {
        return
    }
    if (hasLoadMore && typeof node.childCount === 'number' && Number.isFinite(node.childCount)) {
        node.childCount = Math.max(node.childCount, countable)
        return
    }
    node.childCount = countable
}
